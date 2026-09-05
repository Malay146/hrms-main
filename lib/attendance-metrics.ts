import { lineHours } from "@/lib/schedule-hours";
import { minutesSinceMidnightKolkata, toDateKey } from "@/lib/dates";

export type ScheduleLineInput = {
  weekday: number; // 1=Mon … 7=Sun
  startMin: number;
  endMin: number;
  breakMin: number;
};

export type AttendanceMetricInput = {
  checkIn: Date | null;
  checkOut: Date | null;
  dateKey: string;
  todayKey: string;
  scheduleLines?: ScheduleLineInput[];
  graceMin?: number;
};

/** ISO date key → 1=Mon … 7=Sun (UTC calendar day of the key). */
export function weekdayFromDateKey(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function scheduleLineForDate(
  dateKey: string,
  lines: ScheduleLineInput[] | undefined,
) {
  if (!lines?.length) return null;
  const weekday = weekdayFromDateKey(dateKey);
  return lines.find((line) => line.weekday === weekday) ?? null;
}

export function computeWorkedHours(input: {
  checkIn: Date | null;
  checkOut: Date | null;
  breakMin: number;
}) {
  if (!input.checkIn || !input.checkOut) return null;
  const rawMinutes =
    (input.checkOut.getTime() - input.checkIn.getTime()) / 60_000 - input.breakMin;
  return Math.round(Math.max(0, rawMinutes / 60) * 100) / 100;
}

export function computeExpectedHours(line: ScheduleLineInput | null) {
  if (!line) return 8;
  return lineHours(line.startMin, line.endMin, line.breakMin);
}

export function computeOvertime(worked: number | null, expected: number) {
  if (worked == null) return null;
  return Math.round(Math.max(0, worked - expected) * 100) / 100;
}

export function isLateAgainstSchedule(input: {
  checkIn: Date | null;
  line: ScheduleLineInput | null;
  graceMin?: number;
}) {
  if (!input.checkIn) return false;
  const grace = input.graceMin ?? 0;
  if (!input.line) {
    // Fallback: 09:15 Kolkata (legacy helper threshold).
    return minutesSinceMidnightKolkata(input.checkIn) > 9 * 60 + 15;
  }
  return minutesSinceMidnightKolkata(input.checkIn) > input.line.startMin + grace;
}

export function isMissingCheckout(input: {
  checkIn: Date | null;
  checkOut: Date | null;
  dateKey: string;
  todayKey: string;
}) {
  return Boolean(input.checkIn && !input.checkOut && input.dateKey < input.todayKey);
}

export function deriveAttendanceMetrics(input: AttendanceMetricInput) {
  const line = scheduleLineForDate(input.dateKey, input.scheduleLines);
  const breakMin = line?.breakMin ?? 60;
  const workedHours = computeWorkedHours({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    breakMin,
  });
  const expectedHours = computeExpectedHours(line);
  const overtimeHours = computeOvertime(workedHours, expectedHours);
  const late = isLateAgainstSchedule({
    checkIn: input.checkIn,
    line,
    graceMin: input.graceMin,
  });
  const missingCheckout = isMissingCheckout(input);

  return {
    line,
    workedHours,
    expectedHours,
    overtimeHours,
    late,
    missingCheckout,
  };
}

export function attendanceDateKey(value: Date | string) {
  return toDateKey(value);
}
