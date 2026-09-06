/**
 * Additive seed: +300 diversified employees with schedules, contracts,
 * leave allocations, and attendance history.
 *
 * Run: npx tsx prisma/seed-more-employees.ts
 * Idempotent for emails already present (skips duplicates).
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/db";
import {
  currentPayrollMonth,
  dateFromKey,
  inclusiveDayCount,
  kolkataTodayKey,
  eachDateKey,
} from "../lib/shared/dates";
import { lineHours } from "../lib/people/schedule-hours";
import { BULK_DEPARTMENTS, buildBulkEmployees } from "./seed-bulk-employees";

const DEMO_PASSWORD = "Employee@1234";
const WAVE_START = 300;
const WAVE_COUNT = 300;
const ATTENDANCE_DAYS = 21;

function id() {
  return crypto.randomUUID();
}

function daysAgo(n: number) {
  const today = kolkataTodayKey();
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

function deptCode(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

function weekdayLines(
  weekdays: number[],
  startMin: number,
  endMin: number,
  breakMin: number,
) {
  return weekdays.map((weekday) => ({
    weekday,
    startMin,
    endMin,
    breakMin,
    hours: lineHours(startMin, endMin, breakMin),
  }));
}

async function ensureSchedules(organizationId: string) {
  const existing = await prisma.workingSchedule.findMany({
    where: { organizationId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((row) => [row.name, row.id]));

  async function ensure(
    name: string,
    calendarType: "fixed" | "variable",
    lines: ReturnType<typeof weekdayLines>,
  ) {
    const found = byName.get(name);
    if (found) return found;
    const created = await prisma.workingSchedule.create({
      data: {
        organizationId,
        name,
        calendarType,
        timezone: "Asia/Kolkata",
        active: true,
        hoursPerWeek: lines.reduce((sum, line) => sum + Number(line.hours), 0),
        daysPerWeek: lines.length,
        lines: { create: lines },
      },
    });
    return created.id;
  }

  const standard = await ensure(
    "Standard Office (Mon–Fri)",
    "fixed",
    weekdayLines([1, 2, 3, 4, 5], 9 * 60, 18 * 60, 60),
  );
  const flexible = await ensure(
    "Flexible Core Hours",
    "variable",
    weekdayLines([1, 2, 3, 4, 5], 10 * 60, 19 * 60, 45),
  );
  const support = await ensure(
    "Customer Support (Mon–Sat)",
    "fixed",
    weekdayLines([1, 2, 3, 4, 5, 6], 8 * 60, 16 * 60, 45),
  );
  const night = await ensure(
    "IT Night Shift (Mon–Fri)",
    "fixed",
    weekdayLines([1, 2, 3, 4, 5], 14 * 60, 23 * 60, 45),
  );

  return [standard, flexible, support, night];
}

async function ensureDepartments(organizationId: string) {
  const map: Record<string, string> = {};
  for (const name of BULK_DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: {
        organizationId_code: {
          organizationId,
          code: deptCode(name),
        },
      },
      create: {
        organizationId,
        name,
        code: deptCode(name),
      },
      update: { name },
    });
    map[name] = row.id;
  }
  return map;
}

async function createUser(opts: {
  name: string;
  email: string;
  organizationId: string;
  departmentId: string;
  employeeId: string;
  jobTitle: string;
  phone?: string;
  passwordHash: string;
  basic: number;
  bankAccount: string | null;
  employeeType: "full_time" | "intern" | "contractor";
  status: "active" | "inactive" | "on_leave";
  joinDate: string;
  scheduleId: string | null;
}) {
  const now = new Date();
  const userId = id();
  await prisma.user.create({
    data: {
      id: userId,
      name: opts.name,
      email: opts.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      role: "employee",
      mustChangePassword: false,
      accounts: {
        create: {
          id: id(),
          accountId: userId,
          providerId: "credential",
          issuer: "local:credential",
          password: opts.passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      },
      profile: {
        create: {
          organizationId: opts.organizationId,
          employeeId: opts.employeeId,
          fullName: opts.name,
          role: "employee",
          departmentId: opts.departmentId,
          jobTitle: opts.jobTitle,
          phone: opts.phone ?? null,
          status: opts.status,
          paidLeaveBalance: 20,
          employeeType: opts.employeeType,
          bankAccount: opts.bankAccount,
          wage: opts.basic,
          joinDate: dateFromKey(opts.joinDate),
          scheduleId: opts.scheduleId,
        },
      },
      ...(opts.status === "inactive"
        ? {}
        : {
            payrolls: {
              create: {
                month: currentPayrollMonth(),
                basic: opts.basic,
                hraPct: 20,
                allowancePct: 10,
                deductions: Math.round(opts.basic * 0.05),
              },
            },
          }),
    },
  });
  return userId;
}

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization found. Run npm run db:seed first.");

  const departments = await ensureDepartments(org.id);
  const scheduleIds = await ensureSchedules(org.id);

  const structure = await prisma.salaryStructure.findFirst({
    where: { organizationId: org.id, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!structure) throw new Error("No salary structure. Run npm run db:seed first.");

  const paidType = await prisma.timeOffType.findFirst({
    where: { organizationId: org.id, code: "paid" },
  });
  const compType = await prisma.timeOffType.findFirst({
    where: { organizationId: org.id, code: "comp_off" },
  });
  if (!paidType || !compType) throw new Error("Leave types missing. Run npm run db:seed first.");

  const demoHash = await hashPassword(DEMO_PASSWORD);
  const bulk = buildBulkEmployees(WAVE_COUNT, { startIndex: WAVE_START, wave: 2 });

  const existingEmails = new Set(
    (
      await prisma.user.findMany({
        where: { email: { in: bulk.map((row) => row.email) } },
        select: { email: true },
      })
    ).map((row) => row.email.toLowerCase()),
  );
  const existingIds = new Set(
    (
      await prisma.employeeProfile.findMany({
        where: { organizationId: org.id },
        select: { employeeId: true },
      })
    ).map((row) => row.employeeId),
  );

  const createdUserIds: string[] = [];
  const leaveTodayUserIds: string[] = [];
  const BATCH = 25;

  for (let start = 0; start < bulk.length; start += BATCH) {
    const slice = bulk.slice(start, start + BATCH);
    for (const [index, row] of slice.entries()) {
      if (existingEmails.has(row.email.toLowerCase()) || existingIds.has(row.employeeId)) {
        continue;
      }
      const scheduleId =
        row.status === "inactive"
          ? null
          : row.department === "IT Support"
            ? scheduleIds[3]!
            : row.department === "Customer Success"
              ? scheduleIds[2]!
              : scheduleIds[(start + index) % 3]!;

      const userId = await createUser({
        name: row.name,
        email: row.email,
        organizationId: org.id,
        departmentId: departments[row.department]!,
        employeeId: row.employeeId,
        jobTitle: row.jobTitle,
        phone: row.phone,
        passwordHash: demoHash,
        basic: row.basic,
        bankAccount: row.bankAccount,
        employeeType: row.employeeType,
        status: row.status,
        joinDate: daysAgo(row.joinOffsetDays),
        scheduleId,
      });
      createdUserIds.push(userId);
      existingEmails.add(row.email.toLowerCase());
      existingIds.add(row.employeeId);
      if (row.leaveToday) leaveTodayUserIds.push(userId);
    }
    console.log(
      `Users ${Math.min(start + BATCH, bulk.length)}/${bulk.length} (created so far: ${createdUserIds.length})`,
    );
  }

  if (createdUserIds.length === 0) {
    console.log("No new employees to create (wave already present).");
    const empCount = await prisma.employeeProfile.count({
      where: { organizationId: org.id, role: "employee" },
    });
    console.log(`Total employees now: ${empCount}`);
    return;
  }

  const profiles = await prisma.employeeProfile.findMany({
    where: { userId: { in: createdUserIds } },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      departmentId: true,
      jobTitle: true,
      wage: true,
      scheduleId: true,
      joinDate: true,
      employeeType: true,
      status: true,
    },
    orderBy: { employeeId: "asc" },
  });
  const profileByUserId = new Map(profiles.map((row) => [row.userId, row]));

  // Approved leave covering today for on_leave staff.
  for (let i = 0; i < leaveTodayUserIds.length; i += 1) {
    const userId = leaveTodayUserIds[i]!;
    const profile = profileByUserId.get(userId);
    if (!profile) continue;
    const createdAt = new Date(Date.now() - (2 + (i % 18)) * 86_400_000);
    await prisma.leaveRequest.create({
      data: {
        userId,
        organizationId: profile.organizationId,
        employeeId: profile.id,
        typeId: paidType.id,
        startDate: dateFromKey(daysAgo(1)),
        endDate: dateFromKey(daysAgo(-2)),
        duration: inclusiveDayCount(daysAgo(1), daysAgo(-2)),
        remarks: "Wave-2 seeded PTO overlapping today",
        status: "approved",
        adminComment: "Seed approved",
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // Running contracts (+ occasional expired prior term) — only for new profiles without one.
  const alreadyContracted = new Set(
    (
      await prisma.contract.findMany({
        where: { employeeId: { in: profiles.map((row) => row.id) }, status: "running" },
        select: { employeeId: true },
      })
    ).map((row) => row.employeeId),
  );
  const contractable = profiles.filter(
    (row) => row.status !== "inactive" && !alreadyContracted.has(row.id),
  );

  const maxCode = await prisma.contract.findFirst({
    where: { code: { startsWith: "CON/2026/W2/" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let contractSeq = maxCode?.code
    ? Number(maxCode.code.split("/").pop()) || 0
    : 0;
  contractSeq += 1;

  const CONTRACT_BATCH = 50;
  for (let start = 0; start < contractable.length; start += CONTRACT_BATCH) {
    const slice = contractable.slice(start, start + CONTRACT_BATCH);
    await prisma.contract.createMany({
      data: slice.map((profile, index) => {
        const seq = contractSeq + index;
        const wage = Number(profile.wage ?? 40000);
        const roll = seq % 12;
        let endDate: Date | null = null;
        if (roll === 1) endDate = dateFromKey(daysAgo(-(14 + (seq % 21))));
        else if (roll === 2 || profile.employeeType === "intern") {
          endDate = dateFromKey(daysAgo(-(90 + (seq % 60))));
        } else if (roll === 3 && profile.employeeType === "contractor") {
          endDate = dateFromKey(daysAgo(-(60 + (seq % 30))));
        }
        return {
          code: `CON/2026/W2/${String(seq).padStart(4, "0")}`,
          employeeId: profile.id,
          departmentId: profile.departmentId,
          scheduleId: profile.scheduleId,
          salaryStructureId: structure.id,
          jobTitle: profile.jobTitle,
          wage,
          startDate: profile.joinDate ?? dateFromKey(daysAgo(120)),
          endDate,
          status: "running" as const,
          notes:
            profile.employeeType === "intern"
              ? "Internship agreement"
              : profile.employeeType === "contractor"
                ? "Fixed-term contractor"
                : "Full-time employment",
        };
      }),
    });
    contractSeq += slice.length;
  }

  const expiredExtras = contractable.filter((_, index) => (index + 1) % 12 === 0);
  if (expiredExtras.length > 0) {
    await prisma.contract.createMany({
      data: expiredExtras.map((profile, index) => ({
        code: `CON/2025/W2/${String(Date.now()).slice(-6)}${String(index).padStart(3, "0")}`,
        employeeId: profile.id,
        departmentId: profile.departmentId,
        scheduleId: profile.scheduleId,
        salaryStructureId: structure.id,
        jobTitle: profile.jobTitle,
        wage: Number(profile.wage ?? 40000),
        startDate: dateFromKey(daysAgo(400 + (index % 80))),
        endDate: dateFromKey(daysAgo(45 + (index % 40))),
        status: "expired" as const,
        notes: "Prior term — superseded or not renewed",
      })),
      skipDuplicates: true,
    });
  }
  console.log(`Contracts: ${contractable.length} running (+ ${expiredExtras.length} expired history)`);

  // Leave allocations for active / on_leave (skip if already allocated this year).
  const validityYear = Number(kolkataTodayKey().slice(0, 4));
  const allocTargets = profiles.filter((row) => row.status !== "inactive");
  for (const profile of allocTargets) {
    const existingPaid = await prisma.timeOffAllocation.findUnique({
      where: {
        employeeId_typeId_validityYear: {
          employeeId: profile.id,
          typeId: paidType.id,
          validityYear,
        },
      },
    });
    if (existingPaid) continue;
    await prisma.timeOffAllocation.create({
      data: {
        employeeId: profile.id,
        typeId: paidType.id,
        allocated: 20,
        taken: profile.status === "on_leave" ? 3 : 0,
        validityYear,
        status: "approved",
        description: "Annual paid leave (wave 2)",
      },
    });
    await prisma.timeOffAllocation.create({
      data: {
        employeeId: profile.id,
        typeId: compType.id,
        allocated: 5,
        taken: 0,
        validityYear,
        status: "approved",
        description: "Comp-off bank (wave 2)",
      },
    });
    await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: { paidLeaveBalance: profile.status === "on_leave" ? 17 : 20 },
    });
  }
  console.log(`Allocations checked/created for ${allocTargets.length} staff`);

  // Attendance for last ATTENDANCE_DAYS (weekdays only), categorized by status.
  const fromKey = daysAgo(ATTENDANCE_DAYS - 1);
  const toKey = kolkataTodayKey();
  const dayKeys = eachDateKey(fromKey, toKey).filter((key) => {
    const day = dateFromKey(key).getUTCDay();
    return day !== 0 && day !== 6;
  });

  const leaveOnDay = new Map<string, Set<string>>();
  for (const key of dayKeys) leaveOnDay.set(key, new Set());
  const coveringLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: createdUserIds },
      status: "approved",
      startDate: { lte: dateFromKey(toKey) },
      endDate: { gte: dateFromKey(fromKey) },
    },
    select: { userId: true, startDate: true, endDate: true },
  });
  for (const leave of coveringLeaves) {
    const start = leave.startDate.toISOString().slice(0, 10);
    const end = leave.endDate.toISOString().slice(0, 10);
    for (const key of eachDateKey(start, end)) {
      leaveOnDay.get(key)?.add(leave.userId);
    }
  }

  const activePool = profiles.filter((row) => row.status !== "inactive");
  const attendanceRows: {
    userId: string;
    organizationId: string;
    employeeId: string;
    date: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    status: "present" | "absent" | "half_day" | "leave";
    workedHours: number | null;
  }[] = [];

  for (let dayIndex = 0; dayIndex < dayKeys.length; dayIndex += 1) {
    const key = dayKeys[dayIndex]!;
    const date = dateFromKey(key);
    for (let i = 0; i < activePool.length; i += 1) {
      const profile = activePool[i]!;
      if (leaveOnDay.get(key)?.has(profile.userId)) {
        attendanceRows.push({
          userId: profile.userId,
          organizationId: profile.organizationId,
          employeeId: profile.id,
          date,
          checkIn: null,
          checkOut: null,
          status: "leave",
          workedHours: null,
        });
        continue;
      }

      // Mix: ~78% present, ~8% half, ~8% late-present, ~6% absent (deterministic).
      const roll = (i * 17 + dayIndex * 13) % 100;
      if (roll < 6) {
        attendanceRows.push({
          userId: profile.userId,
          organizationId: profile.organizationId,
          employeeId: profile.id,
          date,
          checkIn: null,
          checkOut: null,
          status: "absent",
          workedHours: null,
        });
        continue;
      }

      const late = roll >= 78 && roll < 86;
      const half = roll >= 86 && roll < 94;
      const checkInHour = late ? 10 : half ? 9 : 9;
      const checkInMin = late ? 35 + (i % 20) : half ? 5 : (i % 25);
      const checkOutHour = half ? 13 : 18;
      const checkOutMin = half ? 0 : 5 + (i % 40);
      const checkIn = new Date(`${key}T${String(checkInHour).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}:00.000+05:30`);
      const checkOut = new Date(`${key}T${String(checkOutHour).padStart(2, "0")}:${String(checkOutMin).padStart(2, "0")}:00.000+05:30`);
      const workedHours =
        Math.round(((checkOut.getTime() - checkIn.getTime()) / 3_600_000) * 100) / 100;

      attendanceRows.push({
        userId: profile.userId,
        organizationId: profile.organizationId,
        employeeId: profile.id,
        date,
        checkIn,
        checkOut,
        status: half ? "half_day" : "present",
        workedHours,
      });
    }
  }

  for (let start = 0; start < attendanceRows.length; start += 400) {
    await prisma.attendance.createMany({
      data: attendanceRows.slice(start, start + 400),
      skipDuplicates: true,
    });
  }
  console.log(`Attendance rows: ${attendanceRows.length} across ${dayKeys.length} weekdays`);

  const byDept = await prisma.employeeProfile.groupBy({
    by: ["departmentId"],
    where: { organizationId: org.id, role: "employee" },
    _count: { _all: true },
  });
  const deptNames = await prisma.department.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  const nameById = new Map(deptNames.map((row) => [row.id, row.name]));
  const distribution = byDept
    .map((row) => ({
      department: nameById.get(row.departmentId) ?? row.departmentId,
      employees: row._count._all,
    }))
    .sort((a, b) => b.employees - a.employees);

  console.log(`\nWave-2 created: ${createdUserIds.length} employees`);
  console.log("Employee distribution by department:");
  for (const row of distribution) {
    console.log(`  ${row.department}: ${row.employees}`);
  }
  console.log(`Password for new employees: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
