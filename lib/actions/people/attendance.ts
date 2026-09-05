"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { mapAttendance } from "@/lib/shared/mappers";
import { deriveAttendanceMetrics } from "@/lib/people/attendance-metrics";
import {
  dateFromKey,
  formatDisplayTime,
  formatHours,
  isLateCheckIn,
  kolkataTodayKey,
  LATE_AFTER_MINUTES,
  minutesSinceMidnightKolkata,
  weekDayKeys,
  workingHours,
} from "@/lib/shared/dates";
import { createNotifications, staffUserIds } from "@/lib/shared/notify";
import { firstZodError } from "@/lib/shared/validations";
import { clampPage, clampPageSize, pageSkip, totalPagesFor } from "@/lib/shared/pagination";
import { withTiming } from "@/lib/shared/logger";
import { z } from "zod";
import type { ActionResult, AttendanceLogItem, AttendanceStatus } from "@/lib/shared/types";

const attendanceListInclude = {
  user: {
    select: {
      email: true,
      profile: {
        select: {
          fullName: true,
          employeeId: true,
          department: { select: { name: true } },
          schedule: {
            select: {
              lines: {
                select: { weekday: true, startMin: true, endMin: true, breakMin: true },
              },
            },
          },
        },
      },
    },
  },
} as const;

async function profileKeysForUser(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { id: true, organizationId: true },
  });
  if (!profile) throw new Error("Employee profile is missing.");
  return { employeeId: profile.id, organizationId: profile.organizationId };
}

/** Detail/edit still needs schedule; list uses the same include for late metrics on one page. */
const attendanceInclude = attendanceListInclude;

const upsertAttendanceSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  status: z.enum(["present", "absent", "half_day", "leave"]),
  notes: z.string().optional().nullable(),
});

async function approvedLeaveToday(userId: string, today: string) {
  return prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: "approved",
      startDate: { lte: dateFromKey(today) },
      endDate: { gte: dateFromKey(today) },
    },
  });
}

async function scheduleLinesForUser(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: {
      schedule: {
        select: {
          lines: { select: { weekday: true, startMin: true, endMin: true, breakMin: true } },
        },
      },
    },
  });
  return profile?.schedule?.lines ?? [];
}

function parseOptionalDateTime(value: string | null | undefined, dateKey: string) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) || value.includes("Z")) {
    return new Date(value);
  }
  // Treat HH:mm as Kolkata local on that date → store as UTC instant via offset +05:30
  if (/^\d{2}:\d{2}$/.test(value)) {
    return new Date(`${dateKey}T${value}:00.000+05:30`);
  }
  return new Date(value);
}

export type AttendanceListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  employeeCode?: string | null;
};

export type AttendanceListResult = {
  logs: AttendanceLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: string;
  to: string;
  stats: {
    present: number;
    late: number;
    leave: number;
    absent: number;
  };
};

function defaultAttendanceWindow() {
  const keys = weekDayKeys();
  return { from: keys[0], to: keys[keys.length - 1] };
}

function attendanceStatusWhere(status?: string): Prisma.AttendanceWhereInput | undefined {
  if (!status || status === "All") return undefined;
  const key = status.toLowerCase();
  if (key === "late") return { status: "present" };
  if (key === "present") return { status: { in: ["present", "half_day"] } };
  if (key === "half day" || key === "half_day") return { status: "half_day" };
  if (key === "leave") return { status: "leave" };
  if (key === "absent") return { status: "absent" };
  return undefined;
}

export async function listAttendanceLogs(
  filters?: AttendanceListQuery,
): Promise<ActionResult<AttendanceListResult>> {
  return withTiming(
    "timing.attendance_list",
    async () => {
  try {
    await requirePermission("managePeople");
    const window = defaultAttendanceWindow();
    const from = filters?.from || window.from;
    const to = filters?.to || window.to;
    const page = clampPage(filters?.page);
    const pageSize = clampPageSize(filters?.pageSize);
    const search = filters?.search?.trim() ?? "";
    const statusFilter = filters?.status?.trim() || "All";
    const lateOnly = statusFilter.toLowerCase() === "late";

    const andUser: Prisma.UserWhereInput[] = [];
    if (filters?.employeeCode) {
      andUser.push({ profile: { employeeId: filters.employeeCode } });
    }
    if (search) {
      andUser.push({
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { profile: { fullName: { contains: search, mode: "insensitive" } } },
          { profile: { employeeId: { contains: search, mode: "insensitive" } } },
        ],
      });
    }
    const userWhere: Prisma.UserWhereInput | undefined =
      andUser.length === 0 ? undefined : andUser.length === 1 ? andUser[0] : { AND: andUser };

    const baseWhere: Prisma.AttendanceWhereInput = {
      date: { gte: dateFromKey(from), lte: dateFromKey(to) },
      ...(userWhere ? { user: userWhere } : {}),
      ...(lateOnly ? { status: "present", checkIn: { not: null } } : attendanceStatusWhere(statusFilter)),
    };

    const [statusGroups, lateProbe] = await Promise.all([
      prisma.attendance.groupBy({
        by: ["status"],
        where: {
          date: { gte: dateFromKey(from), lte: dateFromKey(to) },
          ...(filters?.employeeCode
            ? { user: { profile: { employeeId: filters.employeeCode } } }
            : {}),
        },
        _count: { _all: true },
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: dateFromKey(from), lte: dateFromKey(to) },
          status: "present",
          checkIn: { not: null },
          ...(filters?.employeeCode
            ? { user: { profile: { employeeId: filters.employeeCode } } }
            : {}),
        },
        select: { id: true, checkIn: true },
        take: 8000,
      }),
    ]);

    const lateIds = lateProbe.filter((row) => isLateCheckIn(row.checkIn)).map((row) => row.id);
    const late = lateIds.length;
    const countByStatus = new Map(statusGroups.map((row) => [row.status, row._count._all]));
    const present =
      (countByStatus.get("present") ?? 0) + (countByStatus.get("half_day") ?? 0);
    const leave = countByStatus.get("leave") ?? 0;
    const absent = countByStatus.get("absent") ?? 0;

    const where: Prisma.AttendanceWhereInput = lateOnly
      ? { ...baseWhere, id: { in: lateIds.length ? lateIds : ["__none__"] } }
      : baseWhere;

    const [total, rows] = await Promise.all([
      lateOnly ? Promise.resolve(late) : prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        include: attendanceInclude,
        orderBy: [{ date: "desc" }, { checkIn: "asc" }],
        skip: pageSkip(page, pageSize),
        take: pageSize,
      }),
    ]);

    return {
      ok: true,
      data: {
        logs: rows.map((row) => mapAttendance(row)),
        page,
        pageSize,
        total,
        totalPages: totalPagesFor(total, pageSize),
        from,
        to,
        stats: { present, late, leave, absent },
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load attendance.") };
  }
    },
    {
      page: filters?.page ?? 1,
      status: filters?.status ?? "All",
    },
  );
}

export async function getAttendanceAction(
  id: string,
): Promise<ActionResult<AttendanceLogItem>> {
  try {
    await requirePermission("managePeople");
    const row = await prisma.attendance.findUnique({
      where: { id },
      include: attendanceInclude,
    });
    if (!row) return { ok: false, error: "Attendance record not found." };
    return { ok: true, data: mapAttendance(row) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load attendance.") };
  }
}

export async function listMyAttendance(): Promise<ActionResult<AttendanceLogItem[]>> {
  try {
    const user = await requireUser();
    const keys = weekDayKeys();
    const rows = await prisma.attendance.findMany({
      where: {
        userId: user.id,
        date: { gte: dateFromKey(keys[0]), lte: dateFromKey(keys[keys.length - 1]) },
      },
      include: attendanceInclude,
      orderBy: { date: "desc" },
      take: 60,
    });
    return { ok: true, data: rows.map((row) => mapAttendance(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load your attendance.") };
  }
}

export async function getTodayAttendance() {
  const user = await requireUser();
  const today = kolkataTodayKey();
  const row = await prisma.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: dateFromKey(today) } },
    select: { checkIn: true, checkOut: true },
  });
  if (!row) return null;
  return {
    checkIn: row.checkIn?.toISOString() ?? null,
    checkOut: row.checkOut?.toISOString() ?? null,
  };
}

export async function upsertAttendanceAction(input: {
  id?: string;
  userId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: AttendanceStatus;
  notes?: string | null;
}): Promise<ActionResult<AttendanceLogItem>> {
  try {
    await requirePermission("managePeople");
    const parsed = upsertAttendanceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const checkIn = parseOptionalDateTime(parsed.data.checkIn, parsed.data.date);
    const checkOut = parseOptionalDateTime(parsed.data.checkOut, parsed.data.date);
    if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
      return { ok: false, error: "Check-out cannot be before check-in." };
    }

    const lines = await scheduleLinesForUser(parsed.data.userId);
    const metrics = deriveAttendanceMetrics({
      checkIn,
      checkOut,
      dateKey: parsed.data.date,
      todayKey: kolkataTodayKey(),
      scheduleLines: lines,
    });

    let status = parsed.data.status;
    if (status === "present" && metrics.workedHours != null && metrics.workedHours > 0 && metrics.workedHours < 5) {
      status = "half_day";
    }

    const keys = await profileKeysForUser(parsed.data.userId);
    const data = {
      userId: parsed.data.userId,
      organizationId: keys.organizationId,
      employeeId: keys.employeeId,
      date: dateFromKey(parsed.data.date),
      checkIn,
      checkOut,
      status,
      workedHours: metrics.workedHours,
      overtimeHours: metrics.overtimeHours,
      notes: parsed.data.notes?.trim() || null,
      manualEdit: true,
    };

    const saved = parsed.data.id
      ? await prisma.attendance.update({
          where: { id: parsed.data.id },
          data,
          include: attendanceInclude,
        })
      : await prisma.attendance.upsert({
          where: {
            userId_date: {
              userId: parsed.data.userId,
              date: dateFromKey(parsed.data.date),
            },
          },
          create: data,
          update: data,
          include: attendanceInclude,
        });

    logger.info("attendance.upserted", { attendanceId: saved.id });
    revalidatePath("/admin/people/attendance");
    revalidatePath("/employee/attendance");
    revalidatePath("/admin");
    revalidateTag("attendance", "max");
    void (async () => {
      const { organizationIdForUser, recomputeAttendanceDailyRollup } = await import(
        "@/lib/jobs/handlers/attendance-rollup"
      );
      const orgId = await organizationIdForUser(parsed.data.userId);
      if (orgId) await recomputeAttendanceDailyRollup(orgId, parsed.data.date);
    })().catch(() => undefined);
    return { ok: true, data: mapAttendance(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save attendance.") };
  }
}

export async function clockInAction(): Promise<ActionResult<{ checkIn: string }>> {
  try {
    const user = await requireUser();
    const today = kolkataTodayKey();
    const keys = await profileKeysForUser(user.id);
    const onLeave = await approvedLeaveToday(user.id, today);
    if (onLeave) {
      await prisma.attendance.upsert({
        where: { userId_date: { userId: user.id, date: dateFromKey(today) } },
        update: { status: "leave" },
        create: {
          userId: user.id,
          organizationId: keys.organizationId,
          employeeId: keys.employeeId,
          date: dateFromKey(today),
          status: "leave",
        },
      });
      return { ok: false, error: "You are on approved leave today and cannot check in." };
    }

    const checkIn = new Date();
    await prisma.attendance.create({
      data: {
        userId: user.id,
        organizationId: keys.organizationId,
        employeeId: keys.employeeId,
        date: dateFromKey(today),
        checkIn,
        status: "present",
      },
    });

    if (minutesSinceMidnightKolkata(checkIn) > LATE_AFTER_MINUTES) {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        select: { organizationId: true, fullName: true },
      });
      if (profile) {
        await createNotifications({
          userIds: await staffUserIds(profile.organizationId, user.id),
          title: "Late check-in",
          body: `${profile.fullName} checked in at ${formatDisplayTime(checkIn)}.`,
          category: "attendance",
          href: "/admin/people/attendance",
        });
      }
    }

    logger.info("attendance.checkin", { userId: user.id, date: today });
    revalidatePath("/employee");
    revalidatePath("/employee/attendance");
    revalidatePath("/admin");
    revalidatePath("/admin/people/attendance");
    revalidateTag("attendance", "max");
    void (async () => {
      const { organizationIdForUser, recomputeAttendanceDailyRollup } = await import(
        "@/lib/jobs/handlers/attendance-rollup"
      );
      const orgId = await organizationIdForUser(user.id);
      if (orgId) await recomputeAttendanceDailyRollup(orgId, today);
    })().catch(() => undefined);
    return { ok: true, data: { checkIn: formatDisplayTime(checkIn) } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      logger.warn("attendance.duplicate_checkin", { date: kolkataTodayKey() });
      return { ok: false, error: "You have already checked in today." };
    }
    return { ok: false, error: actionErrorMessage(error, "Could not clock in.") };
  }
}

export async function clockOutAction(): Promise<
  ActionResult<{ checkOut: string; hours: string }>
> {
  try {
    const user = await requireUser();
    const today = kolkataTodayKey();
    const row = await prisma.attendance.findUnique({
      where: { userId_date: { userId: user.id, date: dateFromKey(today) } },
    });

    if (!row?.checkIn) {
      return { ok: false, error: "Check in before you clock out." };
    }
    if (row.checkOut) {
      return { ok: false, error: "You have already clocked out today." };
    }

    const checkOut = new Date();
    if (checkOut.getTime() < row.checkIn.getTime()) {
      return { ok: false, error: "Check-out cannot be before check-in." };
    }

    const lines = await scheduleLinesForUser(user.id);
    const metrics = deriveAttendanceMetrics({
      checkIn: row.checkIn,
      checkOut,
      dateKey: today,
      todayKey: today,
      scheduleLines: lines,
    });
    const hours = metrics.workedHours ?? workingHours(row.checkIn, checkOut);
    const status: AttendanceStatus = hours > 0 && hours < 5 ? "half_day" : "present";

    await prisma.attendance.update({
      where: { id: row.id },
      data: {
        checkOut,
        status,
        workedHours: hours,
        overtimeHours: metrics.overtimeHours,
      },
    });

    logger.info("attendance.checkout", { userId: user.id, date: today });
    revalidatePath("/employee");
    revalidatePath("/employee/attendance");
    revalidatePath("/admin/people/attendance");
    revalidateTag("attendance", "max");
    void (async () => {
      const { organizationIdForUser, recomputeAttendanceDailyRollup } = await import(
        "@/lib/jobs/handlers/attendance-rollup"
      );
      const orgId = await organizationIdForUser(user.id);
      if (orgId) await recomputeAttendanceDailyRollup(orgId, today);
    })().catch(() => undefined);
    return {
      ok: true,
      data: { checkOut: formatDisplayTime(checkOut), hours: formatHours(hours) },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not clock out.") };
  }
}

export async function weeklyAttendanceCounts() {
  const keys = weekDayKeys();
  const rows = await prisma.attendance.groupBy({
    by: ["date"],
    where: {
      date: { gte: dateFromKey(keys[0]), lte: dateFromKey(keys[keys.length - 1]) },
      status: { in: ["present", "half_day"] },
    },
    _count: { _all: true },
  });
  const byDate = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row._count._all]));
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return keys.map((key, index) => ({
    day: labels[index],
    attendance: byDate.get(key) ?? 0,
  }));
}

export async function listAttendanceEmployees(input?: {
  search?: string;
}): Promise<ActionResult<{ userId: string; employeeId: string; name: string }[]>> {
  try {
    await requirePermission("managePeople");
    const search = input?.search?.trim() ?? "";
    const rows = await prisma.employeeProfile.findMany({
      where: {
        status: { not: "inactive" },
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { employeeId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: { userId: true, employeeId: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 40,
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        userId: row.userId,
        employeeId: row.employeeId,
        name: row.fullName,
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load employees.") };
  }
}
