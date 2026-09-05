import { prisma } from "@/lib/db";
import { dateFromKey, isLateCheckIn, toDateKey } from "@/lib/shared/dates";
import { revalidateTag } from "next/cache";

export async function recomputeAttendanceDailyRollup(organizationId: string, dateKey: string) {
  const day = dateFromKey(dateKey);
  const rows = await prisma.attendance.findMany({
    where: {
      date: day,
      user: { profile: { organizationId } },
    },
    select: { status: true, checkIn: true, checkOut: true },
  });

  let presentCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let lateCount = 0;
  let missingCheckoutCount = 0;

  for (const row of rows) {
    if (row.status === "present") presentCount += 1;
    else if (row.status === "half_day") halfDayCount += 1;
    else if (row.status === "absent") absentCount += 1;
    else if (row.status === "leave") leaveCount += 1;
    if (row.status === "present" && isLateCheckIn(row.checkIn)) lateCount += 1;
    if (row.checkIn && !row.checkOut) missingCheckoutCount += 1;
  }

  await prisma.attendanceDailyRollup.upsert({
    where: {
      organizationId_date: { organizationId, date: day },
    },
    create: {
      organizationId,
      date: day,
      presentCount,
      halfDayCount,
      absentCount,
      leaveCount,
      lateCount,
      missingCheckoutCount,
    },
    update: {
      presentCount,
      halfDayCount,
      absentCount,
      leaveCount,
      lateCount,
      missingCheckoutCount,
    },
  });

  revalidateTag("attendance", "max");
  revalidateTag("payroll", "max");
  return {
    date: dateKey,
    presentCount,
    halfDayCount,
    absentCount,
    leaveCount,
    lateCount,
    missingCheckoutCount,
  };
}

export async function runAttendanceRollupBackfillJob(
  organizationId: string,
  fromKey: string,
  toKey: string,
) {
  if (!fromKey || !toKey) throw new Error("from/to date keys required");
  const start = dateFromKey(fromKey);
  const end = dateFromKey(toKey);
  const results = [];
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    const key = toDateKey(new Date(cursor));
    results.push(await recomputeAttendanceDailyRollup(organizationId, key));
  }
  return { days: results.length, from: fromKey, to: toKey };
}

export async function organizationIdForUser(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
  return profile?.organizationId ?? null;
}
