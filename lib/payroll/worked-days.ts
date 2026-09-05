import { dateFromKey, eachDateKey } from "@/lib/shared/dates";

export function weekdayCount(periodStart: string, periodEnd: string) {
  return eachDateKey(periodStart, periodEnd).filter((key) => {
    const day = dateFromKey(key).getUTCDay();
    return day !== 0 && day !== 6;
  }).length;
}

export function unpaidDaysInPeriod(
  periodStart: string,
  periodEnd: string,
  leaves: { type: string; status: string; startDate: string; endDate: string }[],
) {
  const periodDays = new Set(eachDateKey(periodStart, periodEnd));
  let count = 0;
  for (const leave of leaves) {
    if (leave.status !== "approved" || leave.type !== "unpaid") continue;
    for (const key of eachDateKey(leave.startDate, leave.endDate)) {
      const day = dateFromKey(key).getUTCDay();
      if (day === 0 || day === 6) continue;
      if (periodDays.has(key)) count += 1;
    }
  }
  return count;
}

export function stubWorkedDays(scheduledDays: number, unpaidLeaveDays: number) {
  return Math.max(0, scheduledDays - unpaidLeaveDays);
}
