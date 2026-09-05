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

export function isLateCheckIn(checkIn: Date | null | undefined) {
  if (!checkIn) return false;
  return minutesSinceMidnightKolkata(checkIn) > LATE_AFTER_MINUTES;
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

export function compareDateKeys(a: string, b: string) {
  return a.localeCompare(b);
}
