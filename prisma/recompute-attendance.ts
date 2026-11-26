/**
 * Recompute worked hours, overtime, and present/half-day status for every
 * closed attendance row, using the same rules as clock-out
 * (lib/people/attendance-metrics.ts + clockOutAction). Manually edited rows
 * keep their status. Idempotent: only changed rows are written.
 */
import type { PrismaClient } from "../generated/prisma/client";
import { deriveAttendanceMetrics } from "../lib/people/attendance-metrics";
import { kolkataTodayKey, toDateKey } from "../lib/shared/dates";

const HALF_DAY_BELOW_HOURS = 5;

export async function recomputeAttendanceHours(prisma: PrismaClient, organizationId?: string) {
  const today = kolkataTodayKey();
  const profiles = await prisma.employeeProfile.findMany({
    where: organizationId ? { organizationId } : undefined,
    select: {
      id: true,
      schedule: { select: { lines: { select: { weekday: true, startMin: true, endMin: true, breakMin: true } } } },
    },
  });
  const linesByEmployee = new Map(profiles.map((p) => [p.id, p.schedule?.lines ?? []]));

  const rows = await prisma.attendance.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      checkIn: { not: null },
      checkOut: { not: null },
      status: { in: ["present", "half_day"] },
    },
    select: { id: true, employeeId: true, date: true, checkIn: true, checkOut: true, status: true, workedHours: true, overtimeHours: true, manualEdit: true },
  });

  const updates: { id: string; workedHours: number; overtimeHours: number; status: "present" | "half_day" }[] = [];
  for (const row of rows) {
    const dateKey = toDateKey(row.date);
    const metrics = deriveAttendanceMetrics({
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      dateKey,
      todayKey: today,
      scheduleLines: linesByEmployee.get(row.employeeId) ?? [],
    });
    const worked = metrics.workedHours ?? 0;
    const overtime = metrics.overtimeHours ?? 0;
    const status =
      row.manualEdit ? row.status : worked > 0 && worked < HALF_DAY_BELOW_HOURS ? "half_day" : "present";
    if (
      Number(row.workedHours ?? -1) !== worked ||
      Number(row.overtimeHours ?? -1) !== overtime ||
      row.status !== status
    ) {
      updates.push({ id: row.id, workedHours: worked, overtimeHours: overtime, status: status as "present" | "half_day" });
    }
  }

  // One UPDATE ... FROM (VALUES ...) per batch: fast over a remote connection,
  // where hundreds of single-row updates in one transaction time out.
  for (let i = 0; i < updates.length; i += 500) {
    const batch = updates.slice(i, i + 500);
    const values = batch
      .map((_, j) => {
        const n = j * 4;
        return `($${n + 1}, $${n + 2}::numeric, $${n + 3}::numeric, $${n + 4}::"AttendanceStatus")`;
      })
      .join(", ");
    const params = batch.flatMap((u) => [u.id, u.workedHours, u.overtimeHours, u.status]);
    await prisma.$executeRawUnsafe(
      `UPDATE attendance AS a
          SET "workedHours" = v.worked, "overtimeHours" = v.overtime, status = v.status, "updatedAt" = now()
         FROM (VALUES ${values}) AS v(id, worked, overtime, status)
        WHERE a.id = v.id`,
      ...params,
    );
  }
  return { checked: rows.length, updated: updates.length };
}
