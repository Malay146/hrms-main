"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/session";
import { leaveTypeFromCode, mapLeave } from "@/lib/mappers";
import {
  dateFromKey,
  eachDateKey,
  inclusiveDayCount,
  kolkataTodayKey,
  toDateKey,
} from "@/lib/dates";
import {
  findOverlappingLeave,
  paidLeaveDays,
  validateLeaveDates,
} from "@/lib/leave-rules";
import { applyLeaveSchema, decideLeaveSchema, firstZodError } from "@/lib/validations";
import type { ActionResult, CalendarMarker, LeaveListItem, LeaveType } from "@/lib/types";

function revalidateLeave() {
  revalidatePath("/employee/leave");
  revalidatePath("/employee");
  revalidatePath("/admin");
  revalidatePath("/admin/people/leave");
}

const leaveInclude = {
  type: { select: { code: true, name: true } },
  user: {
    select: {
      email: true,
      profile: {
        select: {
          fullName: true,
          department: { select: { name: true } },
        },
      },
    },
  },
} as const;

async function resolveTimeOffTypeId(userId: string, code: LeaveType) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
  if (!profile) throw new Error("Employee profile is missing.");
  const type = await prisma.timeOffType.findUnique({
    where: {
      organizationId_code: {
        organizationId: profile.organizationId,
        code,
      },
    },
  });
  if (!type) throw new Error(`Time off type "${code}" is not configured.`);
  return type.id;
}

export async function listLeaveRequests(): Promise<ActionResult<LeaveListItem[]>> {
  try {
    await requirePermission("approveLeave");
    const rows = await prisma.leaveRequest.findMany({
      include: leaveInclude,
      orderBy: { createdAt: "desc" },
    });
    return { ok: true, data: rows.map((row) => mapLeave(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load leave requests.") };
  }
}

export async function listMyLeaves(): Promise<ActionResult<LeaveListItem[]>> {
  try {
    const user = await requireUser();
    const rows = await prisma.leaveRequest.findMany({
      where: { userId: user.id },
      include: leaveInclude,
      orderBy: { createdAt: "desc" },
    });
    return { ok: true, data: rows.map((row) => mapLeave(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load your leave requests.") };
  }
}

export async function getLeaveCalendarMarkers(): Promise<ActionResult<CalendarMarker[]>> {
  try {
    const user = await requireUser();
    const [attendance, leaves] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId: user.id },
        select: { date: true, status: true },
      }),
      prisma.leaveRequest.findMany({
        where: { userId: user.id, status: "approved" },
        select: { startDate: true, endDate: true },
      }),
    ]);

    const markers = new Map<string, CalendarMarker["kind"]>();
    for (const row of attendance) {
      const key = toDateKey(row.date);
      if (row.status === "leave") markers.set(key, "leave");
      else if (row.status === "absent") markers.set(key, "absent");
      else markers.set(key, "present");
    }
    for (const leave of leaves) {
      for (const key of eachDateKey(toDateKey(leave.startDate), toDateKey(leave.endDate))) {
        markers.set(key, "leave");
      }
    }

    return {
      ok: true,
      data: [...markers.entries()].map(([date, kind]) => ({ date, kind })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load calendar.") };
  }
}

export async function applyLeaveAction(input: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  remarks: string;
}): Promise<ActionResult<LeaveListItem>> {
  try {
    const user = await requireUser();
    const parsed = applyLeaveSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const today = kolkataTodayKey();
    const dateError = validateLeaveDates({
      type: parsed.data.type,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      todayKey: today,
    });
    if (dateError) {
      return { ok: false, error: dateError };
    }

    const existing = await prisma.leaveRequest.findMany({
      where: { userId: user.id, status: { in: ["pending", "approved"] } },
    });
    const overlap = findOverlappingLeave(
      parsed.data.startDate,
      parsed.data.endDate,
      existing.map((row) => ({
        startDate: toDateKey(row.startDate),
        endDate: toDateKey(row.endDate),
        status: row.status,
      })),
    );
    if (overlap) {
      return { ok: false, error: "This range overlaps another pending or approved leave." };
    }

    const typeId = await resolveTimeOffTypeId(user.id, parsed.data.type);
    const duration = inclusiveDayCount(parsed.data.startDate, parsed.data.endDate);

    const created = await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        typeId,
        startDate: dateFromKey(parsed.data.startDate),
        endDate: dateFromKey(parsed.data.endDate),
        duration,
        remarks: parsed.data.remarks,
        status: "pending",
      },
      include: leaveInclude,
    });

    logger.info("leave.applied", { leaveId: created.id, userId: user.id });
    revalidateLeave();
    return { ok: true, data: mapLeave(created) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not submit leave.") };
  }
}

export async function decideLeaveAction(input: {
  leaveId: string;
  decision: "approved" | "rejected";
  adminComment: string;
}): Promise<ActionResult> {
  try {
    const admin = await requirePermission("approveLeave");
    const parsed = decideLeaveSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: parsed.data.leaveId },
      include: { type: { select: { code: true } } },
    });
    if (!leave) {
      return { ok: false, error: "Leave request not found." };
    }
    if (leave.userId === admin.id) {
      return { ok: false, error: "You cannot approve or reject your own leave." };
    }
    if (leave.status !== "pending" && leave.status === parsed.data.decision) {
      return { ok: true, data: undefined };
    }

    const leaveType = leaveTypeFromCode(leave.type.code);
    const days = paidLeaveDays(leaveType, toDateKey(leave.startDate), toDateKey(leave.endDate));

    await prisma.$transaction(async (tx) => {
      if (parsed.data.decision === "approved" && leave.status === "pending" && days > 0) {
        const profile = await tx.employeeProfile.findUnique({ where: { userId: leave.userId } });
        if (!profile || profile.paidLeaveBalance < days) {
          throw new Error("Not enough paid leave balance to approve this request.");
        }
        await tx.employeeProfile.update({
          where: { userId: leave.userId },
          data: { paidLeaveBalance: { decrement: days } },
        });
      }

      if (parsed.data.decision === "rejected" && leave.status === "approved" && days > 0) {
        await tx.employeeProfile.update({
          where: { userId: leave.userId },
          data: { paidLeaveBalance: { increment: days } },
        });
      }

      await tx.leaveRequest.update({
        where: { id: leave.id },
        data: {
          status: parsed.data.decision,
          adminComment: parsed.data.adminComment,
        },
      });

      if (parsed.data.decision === "approved") {
        for (const key of eachDateKey(toDateKey(leave.startDate), toDateKey(leave.endDate))) {
          await tx.attendance.upsert({
            where: { userId_date: { userId: leave.userId, date: dateFromKey(key) } },
            update: { status: "leave", checkIn: null, checkOut: null },
            create: {
              userId: leave.userId,
              date: dateFromKey(key),
              status: "leave",
            },
          });
        }
      }
    });

    logger.info(
      parsed.data.decision === "approved" ? "leave.approved" : "leave.rejected",
      { leaveId: leave.id, adminId: admin.id },
    );
    revalidateLeave();
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not update leave.") };
  }
}

export async function getPaidLeaveBalance() {
  const user = await requireUser();
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
    select: { paidLeaveBalance: true },
  });
  const used = await prisma.leaveRequest.findMany({
    where: { userId: user.id, status: "approved" },
    include: { type: { select: { code: true } } },
  });
  const sickUsed = used
    .filter((row) => row.type.code === "sick")
    .reduce((sum, row) => sum + inclusiveDayCount(toDateKey(row.startDate), toDateKey(row.endDate)), 0);
  const unpaidUsed = used
    .filter((row) => row.type.code === "unpaid")
    .reduce((sum, row) => sum + inclusiveDayCount(toDateKey(row.startDate), toDateKey(row.endDate)), 0);

  return {
    paid: profile?.paidLeaveBalance ?? 20,
    paidTotal: 20,
    sickUsed,
    unpaidUsed,
  };
}
