"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { leaveTypeFromCode, mapLeave } from "@/lib/shared/mappers";
import {
  dateFromKey,
  eachDateKey,
  inclusiveDayCount,
  kolkataTodayKey,
  toDateKey,
} from "@/lib/shared/dates";
import {
  findOverlappingLeave,
  paidLeaveDays,
  validateLeaveDates,
} from "@/lib/people/leave-rules";
import {
  canSubmitRequest,
  remaining,
  takenAfterApproval,
  takenAfterRefusal,
} from "@/lib/people/time-off-balance";
import { applyLeaveSchema, decideLeaveSchema, firstZodError } from "@/lib/shared/validations";
import type { ActionResult, CalendarMarker, LeaveListItem, LeaveType } from "@/lib/shared/types";

function revalidateLeave() {
  revalidatePath("/employee/leave");
  revalidatePath("/employee");
  revalidatePath("/admin");
  revalidatePath("/admin/people/leave");
  revalidatePath("/admin/people/leave/allocations");
}

const leaveInclude = {
  type: { select: { code: true, name: true, requiresAllocation: true } },
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

async function resolveTimeOffType(userId: string, code: LeaveType) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { organizationId: true, id: true },
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
  return { type, profileId: profile.id, organizationId: profile.organizationId };
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

export async function listMyLeaveFormOptions(): Promise<
  ActionResult<{
    types: { id: string; code: string; name: string; requiresAllocation: boolean }[];
    allocations: {
      id: string;
      typeId: string;
      typeName: string;
      remaining: number;
      validityYear: number;
    }[];
  }>
> {
  try {
    const user = await requireUser();
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, organizationId: true },
    });
    if (!profile) return { ok: false, error: "Profile missing." };

    const [types, allocations] = await Promise.all([
      prisma.timeOffType.findMany({
        where: { organizationId: profile.organizationId },
        orderBy: { name: "asc" },
      }),
      prisma.timeOffAllocation.findMany({
        where: { employeeId: profile.id, status: "approved" },
        include: { type: { select: { name: true } } },
      }),
    ]);

    return {
      ok: true,
      data: {
        types: types.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          requiresAllocation: row.requiresAllocation,
        })),
        allocations: allocations.map((row) => ({
          id: row.id,
          typeId: row.typeId,
          typeName: row.type.name,
          remaining: remaining(Number(row.allocated), Number(row.taken)),
          validityYear: row.validityYear,
        })),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load leave options.") };
  }
}

export async function applyLeaveAction(input: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  remarks: string;
  allocationId?: string | null;
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

    const { type } = await resolveTimeOffType(user.id, parsed.data.type);
    const duration = inclusiveDayCount(parsed.data.startDate, parsed.data.endDate);

    let allocationId: string | null = parsed.data.allocationId ?? null;
    if (type.requiresAllocation) {
      if (!allocationId) {
        return { ok: false, error: "Select an approved allocation for this leave type." };
      }
      const allocation = await prisma.timeOffAllocation.findUnique({
        where: { id: allocationId },
      });
      if (!allocation || allocation.typeId !== type.id) {
        return { ok: false, error: "Allocation does not match the selected leave type." };
      }
      const block = canSubmitRequest({
        requiresAllocation: true,
        remaining: remaining(Number(allocation.allocated), Number(allocation.taken)),
        duration,
        allocationStatus: allocation.status,
      });
      if (block) return { ok: false, error: block };
    } else {
      allocationId = null;
    }

    const created = await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        typeId: type.id,
        allocationId,
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
      include: {
        type: { select: { code: true, requiresAllocation: true } },
      },
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
    const days = Number(leave.duration) || paidLeaveDays(
      leaveType,
      toDateKey(leave.startDate),
      toDateKey(leave.endDate),
    );

    await prisma.$transaction(async (tx) => {
      if (parsed.data.decision === "approved" && leave.status === "pending") {
        if (leave.allocationId && leave.type.requiresAllocation) {
          const allocation = await tx.timeOffAllocation.findUnique({
            where: { id: leave.allocationId },
          });
          if (!allocation || allocation.status !== "approved") {
            throw new Error("Allocation is not approved.");
          }
          const rem = remaining(Number(allocation.allocated), Number(allocation.taken));
          if (days > rem) {
            throw new Error("Not enough remaining allocation balance.");
          }
          await tx.timeOffAllocation.update({
            where: { id: allocation.id },
            data: { taken: takenAfterApproval(Number(allocation.taken), days) },
          });
        } else if (leaveType === "paid" && days > 0) {
          const profile = await tx.employeeProfile.findUnique({
            where: { userId: leave.userId },
          });
          if (!profile || profile.paidLeaveBalance < days) {
            throw new Error("Not enough paid leave balance to approve this request.");
          }
          await tx.employeeProfile.update({
            where: { userId: leave.userId },
            data: { paidLeaveBalance: { decrement: days } },
          });
        }
      }

      if (parsed.data.decision === "rejected" && leave.status === "approved") {
        if (leave.allocationId && leave.type.requiresAllocation) {
          const allocation = await tx.timeOffAllocation.findUnique({
            where: { id: leave.allocationId },
          });
          if (allocation) {
            await tx.timeOffAllocation.update({
              where: { id: allocation.id },
              data: { taken: takenAfterRefusal(Number(allocation.taken), days) },
            });
          }
        } else if (leaveType === "paid" && days > 0) {
          await tx.employeeProfile.update({
            where: { userId: leave.userId },
            data: { paidLeaveBalance: { increment: days } },
          });
        }
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
    select: { id: true, paidLeaveBalance: true, organizationId: true },
  });

  const paidType = profile
    ? await prisma.timeOffType.findUnique({
        where: {
          organizationId_code: {
            organizationId: profile.organizationId,
            code: "paid",
          },
        },
      })
    : null;

  const paidAllocation =
    profile && paidType
      ? await prisma.timeOffAllocation.findFirst({
          where: {
            employeeId: profile.id,
            typeId: paidType.id,
            status: "approved",
          },
          orderBy: { validityYear: "desc" },
        })
      : null;

  const used = await prisma.leaveRequest.findMany({
    where: { userId: user.id, status: "approved" },
    include: { type: { select: { code: true } } },
  });
  const sickUsed = used
    .filter((row) => row.type.code === "sick")
    .reduce(
      (sum, row) => sum + inclusiveDayCount(toDateKey(row.startDate), toDateKey(row.endDate)),
      0,
    );
  const unpaidUsed = used
    .filter((row) => row.type.code === "unpaid")
    .reduce(
      (sum, row) => sum + inclusiveDayCount(toDateKey(row.startDate), toDateKey(row.endDate)),
      0,
    );

  if (paidAllocation) {
    const allocated = Number(paidAllocation.allocated);
    const rem = remaining(allocated, Number(paidAllocation.taken));
    return {
      paid: rem,
      paidTotal: allocated,
      sickUsed,
      unpaidUsed,
    };
  }

  return {
    paid: profile?.paidLeaveBalance ?? 20,
    paidTotal: 20,
    sickUsed,
    unpaidUsed,
  };
}
