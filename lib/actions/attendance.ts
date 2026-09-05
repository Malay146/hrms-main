"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/session";
import { mapAttendance } from "@/lib/mappers";
import { deriveAttendanceMetrics } from "@/lib/attendance-metrics";
import {
  dateFromKey,
  formatDisplayTime,
  formatHours,
  kolkataTodayKey,
  weekDayKeys,
  workingHours,
} from "@/lib/dates";
import { firstZodError } from "@/lib/validations";
import { z } from "zod";
import type { ActionResult, AttendanceLogItem, AttendanceStatus } from "@/lib/types";

const attendanceInclude = {
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

export async function listAttendanceLogs(filters?: {
  employeeCode?: string | null;
}): Promise<ActionResult<AttendanceLogItem[]>> {
  try {
    await requirePermission("managePeople");
    const rows = await prisma.attendance.findMany({
      where: filters?.employeeCode
        ? { user: { profile: { employeeId: filters.employeeCode } } }
        : undefined,
      include: attendanceInclude,
      orderBy: [{ date: "desc" }, { checkIn: "asc" }],
    });
    return { ok: true, data: rows.map((row) => mapAttendance(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load attendance.") };
  }
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
    const rows = await prisma.attendance.findMany({
      where: { userId: user.id },
      include: attendanceInclude,
      orderBy: { date: "desc" },
    });
    return { ok: true, data: rows.map((row) => mapAttendance(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load your attendance.") };
  }
}

export async function getTodayAttendance() {
  const user = await requireUser();
  const today = kolkataTodayKey();
  return prisma.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: dateFromKey(today) } },
  });
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

    const data = {
      userId: parsed.data.userId,
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
    return { ok: true, data: mapAttendance(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save attendance.") };
  }
}

export async function clockInAction(): Promise<ActionResult<{ checkIn: string }>> {
  try {
    const user = await requireUser();
    const today = kolkataTodayKey();
    const onLeave = await approvedLeaveToday(user.id, today);
    if (onLeave) {
      await prisma.attendance.upsert({
        where: { userId_date: { userId: user.id, date: dateFromKey(today) } },
        update: { status: "leave" },
        create: {
          userId: user.id,
          date: dateFromKey(today),
          status: "leave",
        },
      });
      return { ok: false, error: "You are on approved leave today and cannot check in." };
    }

    await prisma.attendance.create({
      data: {
        userId: user.id,
        date: dateFromKey(today),
        checkIn: new Date(),
        status: "present",
      },
    });

    logger.info("attendance.checkin", { userId: user.id, date: today });
    revalidatePath("/employee");
    revalidatePath("/employee/attendance");
    revalidatePath("/admin");
    revalidatePath("/admin/people/attendance");
    return { ok: true, data: { checkIn: formatDisplayTime(new Date()) } };
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

export async function listAttendanceEmployees(): Promise<
  ActionResult<{ userId: string; employeeId: string; name: string }[]>
> {
  try {
    await requirePermission("managePeople");
    const rows = await prisma.employeeProfile.findMany({
      select: { userId: true, employeeId: true, fullName: true },
      orderBy: { fullName: "asc" },
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
