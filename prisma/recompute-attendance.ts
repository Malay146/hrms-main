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

  for (let i = 0; i < updates.length; i += 200) {
    await prisma.$transaction(
      updates.slice(i, i + 200).map((u) =>
        prisma.attendance.update({
          where: { id: u.id },
          data: { workedHours: u.workedHours, overtimeHours: u.overtimeHours, status: u.status },
        }),
      ),
    );
  }
  return { checked: rows.length, updated: updates.length };
}
