export const TIMEZONE = "Asia/Kolkata";
export const LATE_AFTER_MINUTES = 9 * 60 + 15;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function kolkataParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function kolkataTodayKey(now = new Date()) {
  const { year, month, day } = kolkataParts(now);
  return formatDateKey(year, month, day);
}

export function kolkataGreeting(now = new Date()) {
  const { hour } = kolkataParts(now);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function toDateKey(value: Date | string) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function formatDisplayDate(value: Date | string) {
  const key = toDateKey(value);
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDisplayTime(value: Date | null | undefined) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

export function minutesSinceMidnightKolkata(value: Date) {
  const { hour, minute } = kolkataParts(value);
  return hour * 60 + minute;
}

export function isLateCheckIn(
  checkIn: Date | null | undefined,
  scheduleStartMin?: number | null,
  graceMin = 0,
) {
  if (!checkIn) return false;
  if (scheduleStartMin == null) {
    return minutesSinceMidnightKolkata(checkIn) > LATE_AFTER_MINUTES;
  }
  return minutesSinceMidnightKolkata(checkIn) > scheduleStartMin + graceMin;
}

export function inclusiveDayCount(startKey: string, endKey: string) {
  const start = dateFromKey(startKey).getTime();
  const end = dateFromKey(endKey).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function eachDateKey(startKey: string, endKey: string) {
  const keys: string[] = [];
  let cursor = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return keys;
}

export function currentPayrollMonth(now = new Date()) {
  const { year, month } = kolkataParts(now);
  return `${year}-${pad(month)}`;
}

export function formatPayrollMonth(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNum - 1, 1)));
}

export function workingHours(checkIn: Date | null, checkOut: Date | null) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 3_600_000);
}

export function formatHours(hours: number) {
  return `${hours.toFixed(1)} hrs`;
}

export function weekDayKeys(now = new Date()) {
  const today = dateFromKey(kolkataTodayKey(now));
  const day = today.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today.getTime() + mondayOffset * 86_400_000);
  return Array.from({ length: 7 }, (_, index) =>
    new Date(monday.getTime() + index * 86_400_000).toISOString().slice(0, 10),
  );
}

export function formatRelativeTime(value: Date, now = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - value.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDisplayDate(value);
}

export function formatNotificationStamp(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TIMEZONE,
  }).format(value);
}

export function compareDateKeys(a: string, b: string) {
  return a.localeCompare(b);
}

export function payslipIssueMonth(now = new Date()) {
  const { year, month, day } = kolkataParts(now);
  const lastDay = new Date(year, month, 0).getDate();
  if (day >= lastDay - 1) {
    return `${year}-${pad(month)}`;
  }
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${pad(month - 1)}`;
}

export function payrollMonthRange(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return {
    start: formatDateKey(year, monthNum, 1),
    end: formatDateKey(year, monthNum, lastDay),
  };
}
