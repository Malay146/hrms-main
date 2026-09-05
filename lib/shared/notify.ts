import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { sendNotificationEmail } from "@/lib/shared/mail";

export type NotificationCategory =
  | "leave"
  | "recruitment"
  | "performance"
  | "attendance"
  | "system"
  | "payroll"
  | "announcement";

const EMAIL_PREF: Partial<
  Record<NotificationCategory, "emailLeave" | "emailRecruitment" | "emailPerformance" | "emailPayroll">
> = {
  leave: "emailLeave",
  recruitment: "emailRecruitment",
  performance: "emailPerformance",
};

export async function createNotifications(input: {
  userIds: string[];
  title: string;
  body: string;
  category: NotificationCategory;
  href?: string | null;
}) {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (userIds.length === 0) return;

  try {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
    });
    const prefByUser = new Map(prefs.map((row) => [row.userId, row]));

    const inAppIds = userIds.filter((id) => prefByUser.get(id)?.inApp !== false);
    if (inAppIds.length > 0) {
      await prisma.notification.createMany({
        data: inAppIds.map((userId) => ({
          userId,
          title: input.title,
          body: input.body,
          category: input.category,
          href: input.href ?? null,
        })),
      });
    }

    const emailFlag = EMAIL_PREF[input.category];
    if (!emailFlag) return;

    const emailUserIds = userIds.filter((id) => {
      const row = prefByUser.get(id);
      if (!row) return emailFlag !== "emailPerformance";
      return Boolean(row[emailFlag]);
    });
    if (emailUserIds.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: emailUserIds } },
      select: { email: true },
    });
    await Promise.allSettled(
      users.map((user) =>
        sendNotificationEmail({
          to: user.email,
          title: input.title,
          body: input.body,
        }),
      ),
    );
  } catch (error) {
    logger.info("notification.create_failed", { error: String(error), title: input.title });
  }
}

export async function staffUserIds(organizationId: string, excludeUserId?: string) {
  const rows = await prisma.user.findMany({
    where: {
      role: { not: "employee" },
      profile: { organizationId },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function organizationUserIds(organizationId: string) {
  const rows = await prisma.employeeProfile.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}
