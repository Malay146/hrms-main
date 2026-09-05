"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { formatNotificationStamp, formatRelativeTime } from "@/lib/shared/dates";
import { createNotifications, organizationUserIds, NOTIFICATION_CATEGORIES } from "@/lib/shared/notify";
import type { NotificationCategory } from "@/lib/shared/notify";
import { clampPage, clampPageSize, pageSkip, totalPagesFor } from "@/lib/shared/pagination";
import type { ActionResult } from "@/lib/shared/types";
import { z } from "zod";
import { firstZodError } from "@/lib/shared/validations";

export type NotificationCategoryName = NotificationCategory;

export type NotificationItem = {
  id: string;
  title: string;
  description: string;
  time: string;
  date: string;
  read: boolean;
  type: NotificationCategoryName;
  category: string;
  href: string | null;
};

export type NotificationPreferences = {
  emailLeave: boolean;
  emailRecruitment: boolean;
  emailPerformance: boolean;
  emailPayroll: boolean;
  inApp: boolean;
  sounds: boolean;
};

const CATEGORY_LABEL: Record<NotificationCategoryName, string> = {
  leave: "Leave",
  recruitment: "Recruitment",
  performance: "Performance",
  attendance: "Attendance",
  system: "System",
  payroll: "Payroll",
  announcement: "Announcement",
};

const preferenceSchema = z.object({
  emailLeave: z.boolean(),
  emailRecruitment: z.boolean(),
  emailPerformance: z.boolean(),
  emailPayroll: z.boolean(),
  inApp: z.boolean(),
  sounds: z.boolean(),
});

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailLeave: true,
  emailRecruitment: true,
  emailPerformance: false,
  emailPayroll: true,
  inApp: true,
  sounds: false,
};

function mapNotification(row: {
  id: string;
  title: string;
  body: string;
  category: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  const type = (NOTIFICATION_CATEGORIES as readonly string[]).includes(row.category)
    ? (row.category as NotificationCategoryName)
    : "system";
  return {
    id: row.id,
    title: row.title,
    description: row.body,
    time: formatRelativeTime(row.createdAt),
    date: formatNotificationStamp(row.createdAt),
    read: Boolean(row.readAt),
    type,
    category: CATEGORY_LABEL[type],
    href: row.href,
  };
}

function revalidateNotifications() {
  revalidatePath("/admin/notifications");
  revalidatePath("/employee/notifications");
}

export async function listMyNotifications(input?: {
  page?: number;
  pageSize?: number;
}): Promise<
  ActionResult<{
    items: NotificationItem[];
    unreadCount: number;
    announcements: NotificationItem[];
    preferences: NotificationPreferences;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>
> {
  try {
    const user = await requireUser();
    const page = clampPage(input?.page);
    const pageSize = clampPageSize(input?.pageSize, 24, 60);
    const [rows, total, unreadCount, announcementRows, prefRow] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip: pageSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.notification.count({ where: { userId: user.id } }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      prisma.notification.findMany({
        where: { userId: user.id, category: "announcement" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    ]);
    const preferences: NotificationPreferences = prefRow
      ? {
          emailLeave: prefRow.emailLeave,
          emailRecruitment: prefRow.emailRecruitment,
          emailPerformance: prefRow.emailPerformance,
          emailPayroll: prefRow.emailPayroll,
          inApp: prefRow.inApp,
          sounds: prefRow.sounds,
        }
      : DEFAULT_PREFERENCES;
    const items = preferences.inApp ? rows.map(mapNotification) : [];
    const announcements = preferences.inApp ? announcementRows.map(mapNotification) : [];
    return {
      ok: true,
      data: {
        items,
        unreadCount: preferences.inApp ? unreadCount : 0,
        announcements,
        preferences,
        page,
        pageSize,
        total: preferences.inApp ? total : 0,
        totalPages: totalPagesFor(preferences.inApp ? total : 0, pageSize),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load notifications.") };
  }
}

export async function markNotificationReadAction(
  id: string,
  read = true,
): Promise<ActionResult<{ id: string; read: boolean }>> {
  try {
    const user = await requireUser();
    const existing = await prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Notification not found." };
    await prisma.notification.update({
      where: { id },
      data: { readAt: read ? new Date() : null },
    });
    revalidateNotifications();
    return { ok: true, data: { id, read } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not update notification.") };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidateNotifications();
    return { ok: true, data: { count: result.count } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not mark notifications read.") };
  }
}

export async function deleteNotificationAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const existing = await prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, error: "Notification not found." };
    await prisma.notification.delete({ where: { id } });
    revalidateNotifications();
    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete notification.") };
  }
}

export async function clearNotificationsAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const result = await prisma.notification.deleteMany({ where: { userId: user.id } });
    revalidateNotifications();
    return { ok: true, data: { count: result.count } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not clear notifications.") };
  }
}

export async function getNotificationPreferences(): Promise<ActionResult<NotificationPreferences>> {
  try {
    const user = await requireUser();
    const row = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });
    return {
      ok: true,
      data: row
        ? {
            emailLeave: row.emailLeave,
            emailRecruitment: row.emailRecruitment,
            emailPerformance: row.emailPerformance,
            emailPayroll: row.emailPayroll,
            inApp: row.inApp,
            sounds: row.sounds,
          }
        : DEFAULT_PREFERENCES,
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load notification settings.") };
  }
}

export async function saveNotificationPreferencesAction(
  input: NotificationPreferences,
): Promise<ActionResult<NotificationPreferences>> {
  try {
    const user = await requireUser();
    const parsed = preferenceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const saved = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data },
      update: parsed.data,
    });
    revalidateNotifications();
    return {
      ok: true,
      data: {
        emailLeave: saved.emailLeave,
        emailRecruitment: saved.emailRecruitment,
        emailPerformance: saved.emailPerformance,
        emailPayroll: saved.emailPayroll,
        inApp: saved.inApp,
        sounds: saved.sounds,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save notification settings.") };
  }
}

export async function createAnnouncementAction(input: {
  title: string;
  body: string;
}): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requirePermission("viewAdminDashboard");
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 2) return { ok: false, error: "Announcement title is required." };
    if (body.length < 2) return { ok: false, error: "Announcement details are required." };
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) return { ok: false, error: "No organization found." };
    const userIds = await organizationUserIds(profile.organizationId);
    await createNotifications({
      userIds,
      title,
      body,
      category: "announcement",
    });
    revalidateNotifications();
    return { ok: true, data: { count: userIds.length } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not post announcement.") };
  }
}
