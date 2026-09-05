"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, requireRole, requireUser } from "@/lib/session";
import { mapAttendance } from "@/lib/mappers";
import {
  dateFromKey,
  formatDisplayTime,
  formatHours,
  kolkataTodayKey,
  weekDayKeys,
  workingHours,
} from "@/lib/dates";
import type { ActionResult, AttendanceLogItem, AttendanceStatus } from "@/lib/types";

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

export async function listAttendanceLogs(): Promise<ActionResult<AttendanceLogItem[]>> {
  try {
    await requireRole("admin");
    const rows = await prisma.attendance.findMany({
      include: {
        user: {
          select: {
            email: true,
            profile: { select: { fullName: true, department: true } },
          },
        },
      },
      orderBy: [{ date: "desc" }, { checkIn: "asc" }],
    });
    return { ok: true, data: rows.map((row) => mapAttendance(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load attendance.") };
  }
}

export async function listMyAttendance(): Promise<ActionResult<AttendanceLogItem[]>> {
  try {
    const user = await requireRole("employee");
    const rows = await prisma.attendance.findMany({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            email: true,
            profile: { select: { fullName: true, department: true } },
          },
        },
      },
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

export async function clockInAction(): Promise<ActionResult<{ checkIn: string }>> {
  try {
    const user = await requireRole("employee");
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

export async function clockOutAction(): Promise<ActionResult<{ checkOut: string; hours: string }>> {
  try {
    const user = await requireRole("employee");
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

    const hours = workingHours(row.checkIn, checkOut);
    const status: AttendanceStatus = hours > 0 && hours < 5 ? "half_day" : "present";

    await prisma.attendance.update({
      where: { id: row.id },
      data: { checkOut, status },
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
