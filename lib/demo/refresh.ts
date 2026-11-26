/**
 * Keep a demo organization looking like a live company, and give every demo
 * login something to do.
 *
 * Idempotent: each step only fills what is missing. Run it from
 * `npm run db:demo-ready` before a demo, and daily through /api/cron/demo when
 * DEMO_MODE=true. It never touches real organizations unless called for them.
 *
 * What it maintains:
 * - attendance for every working day in the last few weeks (missing rows only),
 *   using the same hour/half-day rules as clock-out;
 * - approved leave covering today capped at ~5% of staff (extra leave is moved
 *   to the coming weeks, keeping its length), and profile "on leave" status in
 *   step with real leave;
 * - demo logins with no attendance today, so clock-in can be shown live;
 * - a stock of pending leave requests, draft allocations, and a draft payrun
 *   for the current month to approve or run;
 * - recruitment deadlines and interviews in the future.
 */
import type { CandidateStage } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { recomputeAttendanceDailyRollup } from "@/lib/jobs/handlers/attendance-rollup";
import { deriveAttendanceMetrics } from "@/lib/people/attendance-metrics";
import { dateFromKey, eachDateKey, kolkataTodayKey, toDateKey } from "@/lib/shared/dates";

/** Accounts people log in with during a demo. Never auto-filled for today. */
export const DEMO_LOGIN_EMAILS = [
  "admin@company.com",
  "william.joseph@company.com",
  "kimi.nowa@company.com",
  "priya.shah@company.com",
  "john.cena@company.com",
  "aarav.mehta@company.com",
  "bruce.banner@company.com",
  "sarah.mills@company.com",
  "mark.lou@company.com",
] as const;

const DAY_MS = 86_400_000;
const LOOKBACK_DAYS = 21;
const LEAVE_TODAY_SHARE = 0.05;
const PENDING_LEAVE_TARGET = 8;
const DRAFT_ALLOCATION_TARGET = 5;
const HALF_DAY_BELOW_HOURS = 5;

type Options = {
  /** Clear today's clock-in for the demo logins (manual runs only). */
  resetDemoLogins?: boolean;
  /** Current time; injectable for tests. */
  now?: Date;
};

export type DemoRefreshReport = Record<string, number | string>;

function addDays(key: string, days: number) {
  return new Date(dateFromKey(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function isWeekend(key: string) {
  const day = dateFromKey(key).getUTCDay();
  return day === 0 || day === 6;
}

/** Deterministic 0-99 roll so reruns produce the same data. */
function roll(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

/** An IST wall-clock time on a date, as a UTC instant. */
function istInstant(key: string, minutesAfterMidnight: number) {
  const h = Math.floor(minutesAfterMidnight / 60);
  const m = minutesAfterMidnight % 60;
  return new Date(`${key}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000+05:30`);
}

function minutesNowIst(now: Date) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export async function refreshDemoOrganization(
  organizationId: string,
  options: Options = {},
): Promise<DemoRefreshReport> {
  const now = options.now ?? new Date();
  const today = kolkataTodayKey(now);
  const report: DemoRefreshReport = { today };

  const profiles = await prisma.employeeProfile.findMany({
    where: { organizationId },
    select: {
      id: true,
      userId: true,
      status: true,
      joinDate: true,
      user: { select: { email: true } },
      schedule: { select: { lines: { select: { weekday: true, startMin: true, endMin: true, breakMin: true } } } },
    },
  });
  const demoUserIds = new Set(
    profiles.filter((p) => (DEMO_LOGIN_EMAILS as readonly string[]).includes(p.user.email)).map((p) => p.userId),
  );
  const working = profiles.filter((p) => p.status !== "inactive");

  report.leaveMovedOffToday = await rebalanceLeaveToday(organizationId, today, working.length);
  report.onLeaveStatusSynced = await syncOnLeaveStatus(organizationId, today);
  if (options.resetDemoLogins) {
    const cleared = await prisma.attendance.deleteMany({
      where: {
        organizationId,
        userId: { in: [...demoUserIds] },
        date: dateFromKey(today),
        status: { not: "leave" },
      },
    });
    report.demoLoginsClearedToday = cleared.count;
  }
  const backfill = await backfillAttendance(organizationId, today, now, working, demoUserIds);
  Object.assign(report, backfill);
  report.pendingLeaveCreated = await ensurePendingLeaves(organizationId, today, working, demoUserIds);
  report.draftAllocationsCreated = await ensureDraftAllocations(organizationId, today, working);
  report.currentMonthPayrun = await ensureCurrentMonthPayrun(organizationId, today);
  const recruitment = await refreshRecruitmentDates(organizationId, today, now);
  Object.assign(report, recruitment);

  for (const key of eachDateKey(addDays(today, -LOOKBACK_DAYS), today)) {
    await recomputeAttendanceDailyRollup(organizationId, key);
  }
  return report;
}

/** Move approved leave covering today beyond ~5% of staff to the coming weeks. */
async function rebalanceLeaveToday(organizationId: string, today: string, staff: number) {
  const cap = Math.max(3, Math.round(staff * LEAVE_TODAY_SHARE));
  const covering = await prisma.leaveRequest.findMany({
    where: {
      organizationId,
      status: "approved",
      startDate: { lte: dateFromKey(today) },
      endDate: { gte: dateFromKey(today) },
    },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    select: { id: true, userId: true, startDate: true, endDate: true },
  });
  let moved = 0;
  for (const [index, leave] of covering.slice(cap).entries()) {
    const start = toDateKey(leave.startDate);
    const end = toDateKey(leave.endDate);
    const length = Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / DAY_MS);
    const others = await prisma.leaveRequest.findMany({
      where: { userId: leave.userId, id: { not: leave.id }, status: { in: ["pending", "approved"] } },
      select: { startDate: true, endDate: true },
    });
    let newStart = "";
    for (let attempt = 0; attempt < 6; attempt += 1) {
      let candidate = addDays(today, 7 + (index % 5) * 4 + attempt * 7);
      while (isWeekend(candidate)) candidate = addDays(candidate, 1);
      const candidateEnd = addDays(candidate, length);
      const clash = others.some(
        (o) => toDateKey(o.startDate) <= candidateEnd && toDateKey(o.endDate) >= candidate,
      );
      if (!clash) {
        newStart = candidate;
        break;
      }
    }
    if (!newStart) continue;
    const newEnd = addDays(newStart, length);
    await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({
        where: {
          userId: leave.userId,
          status: "leave",
          date: { gte: leave.startDate, lte: leave.endDate },
        },
      });
      await tx.leaveRequest.update({
        where: { id: leave.id },
        data: { startDate: dateFromKey(newStart), endDate: dateFromKey(newEnd) },
      });
      const profile = await tx.employeeProfile.findUniqueOrThrow({
        where: { userId: leave.userId },
        select: { id: true },
      });
      for (const key of eachDateKey(newStart, newEnd)) {
        await tx.attendance.upsert({
          where: { userId_date: { userId: leave.userId, date: dateFromKey(key) } },
          update: { status: "leave", checkIn: null, checkOut: null, workedHours: null, overtimeHours: null },
          create: { userId: leave.userId, organizationId, employeeId: profile.id, date: dateFromKey(key), status: "leave" },
        });
      }
    });
    moved += 1;
  }
  return moved;
}

/** Profile status "on_leave" exactly when approved leave covers today. */
async function syncOnLeaveStatus(organizationId: string, today: string) {
  const covered = await prisma.leaveRequest.findMany({
    where: {
      organizationId,
      status: "approved",
      startDate: { lte: dateFromKey(today) },
      endDate: { gte: dateFromKey(today) },
    },
    select: { employeeId: true },
  });
  const onLeaveIds = [...new Set(covered.map((row) => row.employeeId))];
  const back = await prisma.employeeProfile.updateMany({
    where: { organizationId, status: "on_leave", id: { notIn: onLeaveIds } },
    data: { status: "active" },
  });
  const away = await prisma.employeeProfile.updateMany({
    where: { organizationId, status: "active", id: { in: onLeaveIds } },
    data: { status: "on_leave" },
  });
  return back.count + away.count;
}

type WorkingProfile = {
  id: string;
  userId: string;
  joinDate: Date | null;
  schedule: { lines: { weekday: number; startMin: number; endMin: number; breakMin: number }[] } | null;
};

/** Fill missing attendance for working days in the lookback window; close stale open shifts. */
async function backfillAttendance(
  organizationId: string,
  today: string,
  now: Date,
  working: WorkingProfile[],
  demoUserIds: Set<string>,
) {
  const from = addDays(today, -LOOKBACK_DAYS);
  const [existing, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { organizationId, date: { gte: dateFromKey(from), lte: dateFromKey(today) } },
      select: { userId: true, date: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        organizationId,
        status: "approved",
        startDate: { lte: dateFromKey(today) },
        endDate: { gte: dateFromKey(from) },
      },
      select: { userId: true, startDate: true, endDate: true },
    }),
  ]);
  const has = new Set(existing.map((row) => `${row.userId}|${toDateKey(row.date)}`));
  const onLeave = new Set<string>();
  for (const leave of leaves) {
    for (const key of eachDateKey(toDateKey(leave.startDate), toDateKey(leave.endDate))) {
      onLeave.add(`${leave.userId}|${key}`);
    }
  }

  const nowMinutes = minutesNowIst(now);
  const rows: {
    userId: string;
    organizationId: string;
    employeeId: string;
    date: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    status: "present" | "half_day" | "absent" | "leave";
    workedHours: number | null;
    overtimeHours: number | null;
  }[] = [];

  for (const key of eachDateKey(from, today)) {
    const isToday = key === today;
    for (const p of working) {
      if (has.has(`${p.userId}|${key}`)) continue;
      if (p.joinDate && toDateKey(p.joinDate) > key) continue;
      const base = { userId: p.userId, organizationId, employeeId: p.id, date: dateFromKey(key) };
      if (onLeave.has(`${p.userId}|${key}`)) {
        rows.push({ ...base, checkIn: null, checkOut: null, status: "leave", workedHours: null, overtimeHours: null });
        continue;
      }
      if (isWeekend(key)) continue;
      if (isToday && demoUserIds.has(p.userId)) continue;
      const r = roll(`${p.id}|${key}`);
      const lateMinutes = r % 7 === 0 ? 30 + (r % 40) : r % 45; // ~1 in 7 arrive after 9:30
      const inMin = 9 * 60 + lateMinutes - 15;
      if (isToday) {
        // Only people whose check-in time has already passed, still on shift.
        if (r < 84 && inMin <= nowMinutes) {
          rows.push({ ...base, checkIn: istInstant(key, inMin), checkOut: null, status: "present", workedHours: null, overtimeHours: null });
        }
        continue;
      }
      if (r < 82) {
        const outMin = 17 * 60 + 30 + ((r * 7) % 100);
        rows.push({ ...base, checkIn: istInstant(key, inMin), checkOut: istInstant(key, outMin), status: "present", workedHours: null, overtimeHours: null });
      } else if (r < 89) {
        const outMin = 13 * 60 + (r % 40);
        rows.push({ ...base, checkIn: istInstant(key, inMin), checkOut: istInstant(key, outMin), status: "half_day", workedHours: null, overtimeHours: null });
      } else {
        rows.push({ ...base, checkIn: null, checkOut: null, status: "absent", workedHours: 0, overtimeHours: 0 });
      }
    }
  }

  // Hours follow the clock-out rules (scheduled break, half day under 5h).
  const linesByEmployee = new Map(working.map((p) => [p.id, p.schedule?.lines ?? []]));
  for (const row of rows) {
    if (!row.checkIn || !row.checkOut) continue;
    const metrics = deriveAttendanceMetrics({
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      dateKey: toDateKey(row.date),
      todayKey: today,
      scheduleLines: linesByEmployee.get(row.employeeId) ?? [],
    });
    row.workedHours = metrics.workedHours ?? 0;
    row.overtimeHours = metrics.overtimeHours ?? 0;
    row.status = row.workedHours > 0 && row.workedHours < HALF_DAY_BELOW_HOURS ? "half_day" : "present";
  }
  for (let i = 0; i < rows.length; i += 500) {
    await prisma.attendance.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
  }

  // Close shifts left open on earlier days by simulated staff (not real demo users).
  const open = await prisma.attendance.findMany({
    where: {
      organizationId,
      date: { gte: dateFromKey(from), lt: dateFromKey(today) },
      checkIn: { not: null },
      checkOut: null,
      userId: { notIn: [...demoUserIds] },
      manualEdit: false,
    },
    select: { id: true, employeeId: true, date: true, checkIn: true },
  });
  for (const row of open) {
    const key = toDateKey(row.date);
    const checkOut = istInstant(key, 17 * 60 + 45 + (roll(row.id) % 60));
    const metrics = deriveAttendanceMetrics({
      checkIn: row.checkIn,
      checkOut,
      dateKey: key,
      todayKey: today,
      scheduleLines: linesByEmployee.get(row.employeeId) ?? [],
    });
    const worked = metrics.workedHours ?? 0;
    await prisma.attendance.update({
      where: { id: row.id },
      data: {
        checkOut,
        workedHours: worked,
        overtimeHours: metrics.overtimeHours ?? 0,
        status: worked > 0 && worked < HALF_DAY_BELOW_HOURS ? "half_day" : "present",
      },
    });
  }
  return { attendanceRowsAdded: rows.length, openShiftsClosed: open.length };
}

const LEAVE_REASONS = [
  "Family function out of town",
  "Doctor's appointment and recovery",
  "Sister's wedding",
  "Moving to a new apartment",
  "Personal errands at the bank",
  "Child's school annual day",
  "Short break after the release",
  "Festival travel home",
];

/** Keep a few future leave requests waiting for approval. */
async function ensurePendingLeaves(
  organizationId: string,
  today: string,
  working: WorkingProfile[],
  demoUserIds: Set<string>,
) {
  const pending = await prisma.leaveRequest.count({
    where: { organizationId, status: "pending", startDate: { gt: dateFromKey(today) } },
  });
  let needed = PENDING_LEAVE_TARGET - pending;
  if (needed <= 0) return 0;
  const types = await prisma.timeOffType.findMany({
    where: { organizationId, code: { in: ["sick", "unpaid"] } },
    select: { id: true, code: true },
  });
  if (types.length === 0) return 0;
  const candidates = working
    .filter((p) => !demoUserIds.has(p.userId))
    .sort((a, b) => roll(`${a.id}|${today}`) - roll(`${b.id}|${today}`));
  let created = 0;
  for (const [i, p] of candidates.entries()) {
    if (needed <= 0 || i > 60) break;
    let start = addDays(today, 3 + i * 2);
    while (isWeekend(start)) start = addDays(start, 1);
    const length = roll(`${p.id}|len`) % 3; // 1-3 days
    const end = addDays(start, length);
    const clash = await prisma.leaveRequest.findFirst({
      where: {
        userId: p.userId,
        status: { in: ["pending", "approved"] },
        startDate: { lte: dateFromKey(end) },
        endDate: { gte: dateFromKey(start) },
      },
      select: { id: true },
    });
    if (clash) continue;
    const type = types[i % types.length]!;
    await prisma.leaveRequest.create({
      data: {
        userId: p.userId,
        organizationId,
        employeeId: p.id,
        typeId: type.id,
        startDate: dateFromKey(start),
        endDate: dateFromKey(end),
        duration: length + 1,
        remarks: LEAVE_REASONS[i % LEAVE_REASONS.length]!,
        status: "pending",
      },
    });
    created += 1;
    needed -= 1;
  }
  return created;
}

/** Keep next year's paid-leave entitlements waiting for approval (HR's year-end task). */
async function ensureDraftAllocations(organizationId: string, today: string, working: WorkingProfile[]) {
  const year = Number(today.slice(0, 4)) + 1;
  const paid = await prisma.timeOffType.findFirst({
    where: { organizationId, code: "paid" },
    select: { id: true },
  });
  if (!paid) return 0;
  const drafts = await prisma.timeOffAllocation.count({
    where: { status: "draft", typeId: paid.id, validityYear: year, employee: { organizationId } },
  });
  let needed = DRAFT_ALLOCATION_TARGET - drafts;
  if (needed <= 0) return 0;
  const taken = new Set(
    (
      await prisma.timeOffAllocation.findMany({
        where: { typeId: paid.id, validityYear: year, employee: { organizationId } },
        select: { employeeId: true },
      })
    ).map((row) => row.employeeId),
  );
  let created = 0;
  for (const p of [...working].sort((a, b) => roll(`${a.id}|alloc`) - roll(`${b.id}|alloc`))) {
    if (needed <= 0) break;
    if (taken.has(p.id)) continue;
    await prisma.timeOffAllocation.create({
      data: {
        employeeId: p.id,
        typeId: paid.id,
        allocated: 20,
        validityYear: year,
        status: "draft",
        description: `${year} annual leave entitlement`,
      },
    });
    created += 1;
    needed -= 1;
  }
  return created;
}

/** A draft payrun for the current month, ready to compute and validate. */
async function ensureCurrentMonthPayrun(organizationId: string, today: string) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [y, m] = monthStart.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
  const existing = await prisma.payrun.findFirst({
    where: {
      organizationId,
      periodStart: { lte: dateFromKey(monthEnd) },
      periodEnd: { gte: dateFromKey(monthStart) },
    },
    select: { name: true },
  });
  if (existing) return `exists: ${existing.name}`;
  const structure = await prisma.salaryStructure.findFirst({
    where: { organizationId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!structure) return "no salary structure";
  const employees = await prisma.employeeProfile.findMany({
    where: {
      organizationId,
      status: { not: "inactive" },
      wage: { gt: 0 },
      contracts: { some: { status: "running" } },
    },
    orderBy: { employeeId: "asc" },
    take: 25,
    select: { id: true },
  });
  if (employees.length === 0) return "no employees with contracts";
  const name = new Date(`${monthStart}T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  await prisma.payrun.create({
    data: {
      organizationId,
      name,
      structureId: structure.id,
      periodStart: dateFromKey(monthStart),
      periodEnd: dateFromKey(monthEnd),
      status: "draft",
      payslips: { create: employees.map((e) => ({ employeeId: e.id, workedDays: 0, status: "draft" })) },
    },
  });
  return `created: ${name} (${employees.length} employees)`;
}

/** Open jobs keep a future deadline; in-progress candidates keep an upcoming interview. */
export async function refreshRecruitmentDates(organizationId: string, today: string, now = new Date()) {
  const todayDate = dateFromKey(today);
  const stale = await prisma.jobOpening.findMany({
    where: { organizationId, status: "active", deadline: { lt: todayDate } },
    select: { id: true },
    orderBy: { code: "asc" },
  });
  for (const [i, job] of stale.entries()) {
    await prisma.jobOpening.update({
      where: { id: job.id },
      data: { deadline: new Date(todayDate.getTime() + (21 + i * 7) * DAY_MS) },
    });
  }
  const inProgress: CandidateStage[] = ["screening", "interview", "technical"];
  const pastInterviews = await prisma.candidate.findMany({
    where: { organizationId, interviewAt: { lt: now }, stage: { in: inProgress } },
    select: { id: true, interviewAt: true },
    orderBy: { interviewAt: "asc" },
  });
  for (const [i, c] of pastInterviews.entries()) {
    const time = c.interviewAt!.toISOString().slice(11);
    const day = new Date(todayDate.getTime() + (1 + (i % 5)) * DAY_MS).toISOString().slice(0, 10);
    await prisma.candidate.update({ where: { id: c.id }, data: { interviewAt: new Date(`${day}T${time}`) } });
  }
  return { jobDeadlinesMoved: stale.length, interviewsRescheduled: pastInterviews.length };
}
