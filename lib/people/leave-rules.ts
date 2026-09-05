import { compareDateKeys, inclusiveDayCount } from "@/lib/shared/dates";
import type { LeaveType } from "@/lib/shared/types";

export type LeaveWindow = {
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
};

export function datesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return compareDateKeys(startA, endB) <= 0 && compareDateKeys(startB, endA) <= 0;
}

export function findOverlappingLeave(
  startDate: string,
  endDate: string,
  existing: LeaveWindow[],
) {
  return existing.find(
    (leave) =>
      leave.status !== "rejected" &&
      datesOverlap(startDate, endDate, leave.startDate, leave.endDate),
  );
}

export function validateLeaveDates(input: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  todayKey: string;
}) {
  if (compareDateKeys(input.endDate, input.startDate) < 0) {
    return "End date cannot be before start date.";
  }

  if (input.type === "sick") {
    if (compareDateKeys(input.startDate, input.todayKey) < 0) {
      return "Sick leave cannot start in the past.";
    }
  } else if (compareDateKeys(input.startDate, input.todayKey) <= 0) {
    return "Leave cannot start today or in the past.";
  }

  return null;
}

export function paidLeaveDays(type: LeaveType, startDate: string, endDate: string) {
  if (type !== "paid") return 0;
  return inclusiveDayCount(startDate, endDate);
}
