import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/db";
import {
  currentPayrollMonth,
  dateFromKey,
  inclusiveDayCount,
  kolkataTodayKey,
  weekDayKeys,
} from "../lib/shared/dates";
import { computePayslip } from "../lib/payroll/compute";
import { REGULAR_SALARY_RULES } from "../lib/payroll/regular-salary";
import { lineHours } from "../lib/people/schedule-hours";
import { BULK_DEPARTMENTS, buildBulkEmployees } from "./seed-bulk-employees";
import { seedRecruitment } from "./seed-recruitment";

const ADMIN_EMAIL = "admin@oddo.com";
const ADMIN_PASSWORD = "admin@oddo@1234";
const DEMO_PASSWORD = "Employee@1234";

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

async function createUser(opts: {
  name: string;
  email: string;
  role: "admin" | "hr_manager" | "hr_payroll_user" | "hr_payroll_manager" | "employee";
  organizationId: string;
  departmentId: string;
  employeeId: string;
  jobTitle: string;
  phone?: string;
  passwordHash: string;
  basic: number;
  wage?: number | null;
  bankAccount?: string | null;
  employeeType?: "full_time" | "intern" | "contractor";
  status?: "active" | "inactive" | "on_leave";
  joinDate?: string | null;
  scheduleId?: string | null;
  mustChangePassword?: boolean;
  withPayroll?: boolean;
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
      role: opts.role,
      mustChangePassword: opts.mustChangePassword ?? false,
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
          role: opts.role,
          departmentId: opts.departmentId,
          jobTitle: opts.jobTitle,
          phone: opts.phone ?? null,
          status: opts.status ?? "active",
          paidLeaveBalance: 20,
          employeeType: opts.employeeType ?? "full_time",
          bankAccount: opts.bankAccount ?? null,
          wage: opts.wage ?? (opts.basic || null),
          joinDate: opts.joinDate ? dateFromKey(opts.joinDate) : null,
          scheduleId: opts.scheduleId ?? null,
        },
      },
      ...(opts.withPayroll === false
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
  await prisma.payslipLine.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrun.deleteMany();
  await prisma.salaryRule.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.aiInsight.deleteMany();
  await prisma.timeOffAllocation.deleteMany();
  await prisma.timeOffType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.attendanceDailyRollup.deleteMany();
  await prisma.orgMetricsSnapshot.deleteMany();
  await prisma.backgroundJob.deleteMany();
  await prisma.performanceGoal.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.performanceCycle.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobOpening.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.copilotMessage.deleteMany();
  await prisma.copilotConversation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.workingScheduleLine.deleteMany();
  await prisma.workingSchedule.deleteMany();
  await prisma.department.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const adminHash = await hashPassword(ADMIN_PASSWORD);
  const demoHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  const organization = await prisma.organization.create({
    data: {
      name: "Oddo",
      email: ADMIN_EMAIL,
      slug: "ODDO",
    },
  });

  const departmentNames = [...BULK_DEPARTMENTS];
  const departments: Record<string, string> = {};
  for (const name of departmentNames) {
    const dept = await prisma.department.create({
      data: {
        organizationId: organization.id,
        name,
        code: deptCode(name),
      },
    });
    departments[name] = dept.id;
  }

  const timeOffDefs = [
    { name: "Paid Time Off", code: "paid", requiresAllocation: true },
    { name: "Sick Leave", code: "sick", requiresAllocation: false },
    { name: "Unpaid Leave", code: "unpaid", requiresAllocation: false },
    { name: "Comp Off", code: "comp_off", requiresAllocation: true },
  ] as const;

  const timeOffTypes: Record<string, string> = {};
  for (const def of timeOffDefs) {
    const row = await prisma.timeOffType.create({
      data: {
        organizationId: organization.id,
        name: def.name,
        code: def.code,
        requiresAllocation: def.requiresAllocation,
      },
    });
    timeOffTypes[def.code] = row.id;
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

  const standardLines = weekdayLines([1, 2, 3, 4, 5], 9 * 60, 18 * 60, 60);
  const flexibleLines = weekdayLines([1, 2, 3, 4, 5], 10 * 60, 19 * 60, 45);
  const supportLines = weekdayLines([1, 2, 3, 4, 5, 6], 8 * 60, 16 * 60, 45);

  const scheduleStandard = await prisma.workingSchedule.create({
    data: {
      organizationId: organization.id,
      name: "Standard Office (Mon–Fri)",
      calendarType: "fixed",
      timezone: "Asia/Kolkata",
      active: true,
      hoursPerWeek: standardLines.reduce((sum, line) => sum + Number(line.hours), 0),
      daysPerWeek: 5,
      lines: { create: standardLines },
    },
  });
  const scheduleFlexible = await prisma.workingSchedule.create({
    data: {
      organizationId: organization.id,
      name: "Flexible Core Hours",
      calendarType: "variable",
      timezone: "Asia/Kolkata",
      active: true,
      hoursPerWeek: flexibleLines.reduce((sum, line) => sum + Number(line.hours), 0),
      daysPerWeek: 5,
      lines: { create: flexibleLines },
    },
  });
  const scheduleSupport = await prisma.workingSchedule.create({
    data: {
      organizationId: organization.id,
      name: "Customer Support (Mon–Sat)",
      calendarType: "fixed",
      timezone: "Asia/Kolkata",
      active: true,
      hoursPerWeek: supportLines.reduce((sum, line) => sum + Number(line.hours), 0),
      daysPerWeek: 6,
      lines: { create: supportLines },
    },
  });
  const scheduleIds = [scheduleStandard.id, scheduleFlexible.id, scheduleSupport.id];

  const adminId = await createUser({
    name: "Admin",
    email: ADMIN_EMAIL,
    role: "admin",
    organizationId: organization.id,
    departmentId: departments["Human Resources"],
    employeeId: "ODDO-2026-001",
    jobTitle: "Administrator",
    passwordHash: adminHash,
    basic: 0,
    scheduleId: scheduleStandard.id,
  });

  const people = [
    {
      name: "William Joseph",
      email: "william.joseph@oddo.com",
      role: "hr_manager" as const,
      employeeId: "ODDO-2026-002",
      department: "Human Resources",
      jobTitle: "HR Specialist",
      phone: "+91 98765 43210",
      basic: 6500,
    },
    {
      name: "Bruce Banner",
      email: "bruce.banner@oddo.com",
      role: "employee" as const,
      employeeId: "ODDO-2026-003",
      department: "Engineering",
      jobTitle: "Engineering Lead",
      basic: 12000,
    },
    {
      name: "Sarah Mills",
      email: "sarah.mills@oddo.com",
      role: "employee" as const,
      employeeId: "ODDO-2026-004",
      department: "Human Resources",
      jobTitle: "HR Generalist",
      basic: 5500,
    },
    {
      name: "John Cena",
      email: "john.cena@oddo.com",
      role: "employee" as const,
      employeeId: "ODDO-2026-005",
      department: "Engineering",
      jobTitle: "Frontend Engineer",
      basic: 7200,
    },
    {
      name: "Mark Lou",
      email: "mark.lou@oddo.com",
      role: "employee" as const,
      employeeId: "ODDO-2026-006",
      department: "Sales",
      jobTitle: "Sales Executive",
      basic: 0,
      wage: null,
      bankAccount: null,
    },
    {
      name: "Kimi Nowa",
      email: "kimi.nowa@oddo.com",
      role: "hr_payroll_manager" as const,
      employeeId: "ODDO-2026-007",
      department: "Finance",
      jobTitle: "Payroll Manager",
      basic: 8000,
      wage: 8000,
      bankAccount: "SBIN0001111",
    },
    {
      name: "Aarav Mehta",
      email: "aarav.mehta@oddo.com",
      role: "employee" as const,
      employeeId: "ODDO-2026-008",
      department: "Finance",
      jobTitle: "Payroll Specialist",
      phone: "+91 98765 43210",
      basic: 50000,
      wage: 50000,
      bankAccount: "HDFC0001234",
    },
    {
      name: "Priya Shah",
      email: "priya.shah@oddo.com",
      role: "hr_payroll_user" as const,
      employeeId: "ODDO-2026-009",
      department: "Finance",
      jobTitle: "Payroll Officer",
      basic: 7000,
      wage: 7000,
      bankAccount: "ICIC0009876",
    },
  ];

  const userIds: Record<string, string> = { admin: adminId };
  for (const [index, person] of people.entries()) {
    userIds[person.email] = await createUser({
      name: person.name,
      email: person.email,
      role: person.role,
      organizationId: organization.id,
      departmentId: departments[person.department],
      employeeId: person.employeeId,
      jobTitle: person.jobTitle,
      phone: person.phone,
      passwordHash: demoHash,
      basic: person.basic,
      wage: "wage" in person ? person.wage : undefined,
      bankAccount: "bankAccount" in person ? person.bankAccount : undefined,
      scheduleId: scheduleIds[index % scheduleIds.length],
    });
  }

  // Bulk roster for demos (~300). Shared password hash keeps seeding fast.
  const bulk = buildBulkEmployees(300);
  const leaveTodayUserIds: string[] = [];
  const BULK_BATCH = 40;
  for (let start = 0; start < bulk.length; start += BULK_BATCH) {
    const slice = bulk.slice(start, start + BULK_BATCH);
    const created = await Promise.all(
      slice.map((row, index) =>
        createUser({
          name: row.name,
          email: row.email,
          role: "employee",
          organizationId: organization.id,
          departmentId: departments[row.department],
          employeeId: row.employeeId,
          jobTitle: row.jobTitle,
          phone: row.phone,
          passwordHash: demoHash,
          basic: row.basic,
          wage: row.basic,
          bankAccount: row.bankAccount,
          employeeType: row.employeeType,
          status: row.status,
          joinDate: daysAgo(row.joinOffsetDays),
          scheduleId:
            row.status === "inactive" ? null : scheduleIds[(start + index) % scheduleIds.length],
          withPayroll: row.status !== "inactive",
        }),
      ),
    );
    slice.forEach((row, index) => {
      userIds[row.email] = created[index]!;
      if (row.leaveToday) leaveTodayUserIds.push(created[index]!);
    });
    console.log(`Seeded employees ${Math.min(start + BULK_BATCH, bulk.length)}/${bulk.length}`);
  }

  // Approved leave covering today → shows in "On Leave" kanban via leave overlay + status.
  for (let i = 0; i < leaveTodayUserIds.length; i += 1) {
    const userId = leaveTodayUserIds[i]!;
    const createdAt = new Date(Date.now() - (2 + (i % 18)) * 86_400_000 - (i % 9) * 3_600_000);
    await prisma.leaveRequest.create({
      data: {
        userId,
        typeId: timeOffTypes.paid,
        startDate: dateFromKey(daysAgo(1)),
        endDate: dateFromKey(daysAgo(-2)),
        duration: inclusiveDayCount(daysAgo(1), daysAgo(-2)),
        remarks: "Seeded PTO overlapping today",
        status: "approved",
        adminComment: "Seed approved",
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // Contracts for active / on-leave staff (skip inactive).
  const contractProfiles = await prisma.employeeProfile.findMany({
    where: {
      organizationId: organization.id,
      status: { not: "inactive" },
    },
    select: {
      id: true,
      departmentId: true,
      jobTitle: true,
      wage: true,
      scheduleId: true,
      joinDate: true,
      employeeType: true,
    },
    orderBy: { employeeId: "asc" },
  });

  const structureEarly = await prisma.salaryStructure.create({
    data: {
      organizationId: organization.id,
      name: "Regular Salary",
      active: true,
      rules: {
        create: REGULAR_SALARY_RULES.map((rule) => ({
          name: rule.name,
          code: rule.code,
          category: rule.category,
          sequence: rule.sequence,
          computation: rule.computation,
          amount: rule.amount ?? null,
          percentage: rule.percentage ?? null,
          percentBaseCode: rule.percentBaseCode ?? null,
          formula: rule.formula ?? null,
        })),
      },
    },
  });

  const CONTRACT_BATCH = 50;
  let contractSeq = 1;
  for (let start = 0; start < contractProfiles.length; start += CONTRACT_BATCH) {
    const slice = contractProfiles.slice(start, start + CONTRACT_BATCH);
    await prisma.contract.createMany({
      data: slice.map((profile, index) => {
        const seq = contractSeq + index;
        const wage = Number(profile.wage ?? 40000);
        const roll = seq % 12;
        // Every active/on-leave employee gets a running contract. Vary end dates only.
        let endDate: Date | null = null;
        if (roll === 1) {
          endDate = dateFromKey(daysAgo(-(14 + (seq % 21)))); // ends within ~5 weeks
        } else if (roll === 2 || profile.employeeType === "intern") {
          endDate = dateFromKey(daysAgo(-(90 + (seq % 60))));
        } else if (roll === 3 && profile.employeeType === "contractor") {
          endDate = dateFromKey(daysAgo(-(60 + (seq % 30))));
        }

        return {
          code: `CON/2026/${String(seq).padStart(4, "0")}`,
          employeeId: profile.id,
          departmentId: profile.departmentId,
          scheduleId: profile.scheduleId,
          salaryStructureId: structureEarly.id,
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
    console.log(
      `Seeded contracts ${Math.min(start + CONTRACT_BATCH, contractProfiles.length)}/${contractProfiles.length}`,
    );
  }

  // Prior expired terms for ~1/12 of staff (history only — does not replace running).
  const expiredExtras = contractProfiles.filter((_, index) => (index + 1) % 12 === 0);
  if (expiredExtras.length > 0) {
    await prisma.contract.createMany({
      data: expiredExtras.map((profile, index) => ({
        code: `CON/2025/${String(index + 1).padStart(4, "0")}`,
        employeeId: profile.id,
        departmentId: profile.departmentId,
        scheduleId: profile.scheduleId,
        salaryStructureId: structureEarly.id,
        jobTitle: profile.jobTitle,
        wage: Number(profile.wage ?? 40000),
        startDate: dateFromKey(daysAgo(400 + (index % 80))),
        endDate: dateFromKey(daysAgo(45 + (index % 40))),
        status: "expired" as const,
        notes: "Prior term — superseded or not renewed",
      })),
    });
  }

  // Demo leave rows (dates use daysAgo: negative = future; start must be ≤ end).
  const leaveSeeds = [
    {
      userId: userIds["john.cena@oddo.com"],
      code: "sick",
      start: daysAgo(-1),
      end: daysAgo(-2),
      remarks: "Medical checkup",
      status: "pending" as const,
      hoursAgo: 2,
    },
    {
      userId: userIds["sarah.mills@oddo.com"],
      code: "paid",
      start: daysAgo(-8),
      end: daysAgo(-10),
      remarks: "Family vacation",
      status: "approved" as const,
      adminComment: "Approved",
      hoursAgo: 28,
    },
    {
      userId: userIds["mark.lou@oddo.com"],
      code: "unpaid",
      start: daysAgo(5),
      end: daysAgo(5),
      remarks: "Personal errand",
      status: "rejected" as const,
      adminComment: "Insufficient notice",
      hoursAgo: 6,
    },
  ];

  for (const leave of leaveSeeds) {
    const createdAt = new Date(Date.now() - leave.hoursAgo * 3_600_000);
    await prisma.leaveRequest.create({
      data: {
        userId: leave.userId,
        typeId: timeOffTypes[leave.code],
        startDate: dateFromKey(leave.start),
        endDate: dateFromKey(leave.end),
        duration: inclusiveDayCount(leave.start, leave.end),
        remarks: leave.remarks,
        status: leave.status,
        adminComment: leave.adminComment ?? null,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  const clashLeaves = [
    {
      userId: userIds["bruce.banner@oddo.com"],
      code: "paid",
      start: daysAgo(1),
      end: daysAgo(-1),
      remarks: "On-site workshop with the frontend team",
      status: "approved" as const,
      adminComment: "Approved",
      hoursAgo: 4,
    },
    {
      userId: userIds["john.cena@oddo.com"],
      code: "paid",
      start: daysAgo(1),
      end: daysAgo(-1),
      remarks: "Family in town overlapping the workshop week",
      status: "pending" as const,
      hoursAgo: 1,
    },
  ];

  for (const leave of clashLeaves) {
    const createdAt = new Date(Date.now() - leave.hoursAgo * 3_600_000);
    await prisma.leaveRequest.create({
      data: {
        userId: leave.userId,
        typeId: timeOffTypes[leave.code],
        startDate: dateFromKey(leave.start),
        endDate: dateFromKey(leave.end),
        duration: inclusiveDayCount(leave.start, leave.end),
        remarks: leave.remarks,
        status: leave.status,
        adminComment: leave.adminComment ?? null,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }

  // Allocations for types that require them + sync paid balances from approved leave.
  const allocProfiles = await prisma.employeeProfile.findMany({
    where: { organizationId: organization.id, status: { not: "inactive" } },
    select: { id: true, userId: true },
  });
  const validityYear = Number(kolkataTodayKey().slice(0, 4));
  const approvedPaidByUser = new Map<string, number>();
  const paidLeaves = await prisma.leaveRequest.findMany({
    where: { typeId: timeOffTypes.paid, status: "approved" },
    select: { userId: true, duration: true },
  });
  for (const row of paidLeaves) {
    approvedPaidByUser.set(
      row.userId,
      (approvedPaidByUser.get(row.userId) ?? 0) + Math.max(0, Number(row.duration)),
    );
  }
  const paidAllocationByUser = new Map<string, string>();
  for (const profile of allocProfiles) {
    const taken = Math.min(20, approvedPaidByUser.get(profile.userId) ?? 0);
    const paidAlloc = await prisma.timeOffAllocation.create({
      data: {
        employeeId: profile.id,
        typeId: timeOffTypes.paid,
        allocated: 20,
        taken,
        validityYear,
        status: "approved",
        description: "Annual paid leave",
      },
    });
    paidAllocationByUser.set(profile.userId, paidAlloc.id);
    await prisma.timeOffAllocation.create({
      data: {
        employeeId: profile.id,
        typeId: timeOffTypes.comp_off,
        allocated: 5,
        taken: 0,
        validityYear,
        status: "approved",
        description: "Comp-off bank",
      },
    });
    await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: { paidLeaveBalance: Math.max(0, 20 - taken) },
    });
  }
  for (const leave of await prisma.leaveRequest.findMany({
    where: { typeId: timeOffTypes.paid },
    select: { id: true, userId: true },
  })) {
    const allocationId = paidAllocationByUser.get(leave.userId);
    if (!allocationId) continue;
    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { allocationId },
    });
  }
  console.log(`Seeded allocations for ${allocProfiles.length} staff`);

  // Attendance for the current week — leave status only when an approved leave covers the day.
  const weekKeys = weekDayKeys();
  const todayKey = kolkataTodayKey();
  const attendancePool = await prisma.employeeProfile.findMany({
    where: { organizationId: organization.id, status: { not: "inactive" } },
    select: { userId: true },
    orderBy: { employeeId: "asc" },
  });
  const poolIds = attendancePool.map((row) => row.userId);
  const poolSize = poolIds.length;

  const leaveOnDay = new Map<string, Set<string>>();
  for (const key of weekKeys) leaveOnDay.set(key, new Set());
  const coveringLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "approved",
      startDate: { lte: dateFromKey(weekKeys[weekKeys.length - 1]!) },
      endDate: { gte: dateFromKey(weekKeys[0]!) },
    },
    select: { userId: true, startDate: true, endDate: true },
  });
  for (const leave of coveringLeaves) {
    const start = leave.startDate.toISOString().slice(0, 10);
    const end = leave.endDate.toISOString().slice(0, 10);
    let cursor = dateFromKey(start);
    const endDate = dateFromKey(end);
    while (cursor.getTime() <= endDate.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      leaveOnDay.get(key)?.add(leave.userId);
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  }

  const weekdayFactors = [0.62, 0.84, 0.71, 0.9, 0.78];
  const attendanceRows: {
    userId: string;
    date: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    status: "present" | "absent" | "half_day" | "leave";
    workedHours: number | null;
  }[] = [];

  for (let dayIndex = 0; dayIndex < weekKeys.length; dayIndex += 1) {
    const key = weekKeys[dayIndex]!;
    const onLeave = [...(leaveOnDay.get(key) ?? [])];
    const available = poolIds.filter((id) => !leaveOnDay.get(key)?.has(id));
    const availableSize = available.length;
    const utcDay = dateFromKey(key).getUTCDay();
    const presentTarget =
      key === todayKey
        ? Math.max(40, Math.floor(poolSize * 0.78))
        : utcDay === 0 || utcDay === 6
          ? Math.max(12, Math.floor(poolSize * 0.14))
          : Math.max(20, Math.floor(poolSize * (weekdayFactors[dayIndex] ?? 0.75)));
    const presentCount = Math.min(presentTarget, availableSize);
    const halfDayCount = Math.min(availableSize, Math.max(2, Math.floor(presentCount * 0.1)));
    const presentOnly = Math.max(0, presentCount - halfDayCount);
    const absentCount = Math.max(0, availableSize - presentOnly - halfDayCount);
    const date = dateFromKey(key);

    const offset = availableSize === 0 ? 0 : (dayIndex * 17) % availableSize;
    const rotated =
      availableSize === 0
        ? []
        : [...available.slice(offset), ...available.slice(0, offset)];
    let cursor = 0;
    const take = (n: number) => {
      const slice = rotated.slice(cursor, cursor + n);
      cursor += n;
      return slice;
    };

    for (const userId of onLeave) {
      attendanceRows.push({
        userId,
        date,
        checkIn: null,
        checkOut: null,
        status: "leave",
        workedHours: 0,
      });
    }
    for (const [i, userId] of take(presentOnly).entries()) {
      const late = i % 4 === 0;
      const hourUtc = late ? 4 + (i % 2) : 2 + (i % 2);
      const minute = late ? 45 + (i % 10) : 5 + (i % 40);
      const checkIn = new Date(
        `${key}T${String(hourUtc).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
      );
      const checkOut =
        key === todayKey && i % 7 === 0
          ? null
          : new Date(`${key}T1${1 + (i % 3)}:${String(i % 50).padStart(2, "0")}:00.000Z`);
      attendanceRows.push({
        userId,
        date,
        checkIn,
        checkOut,
        status: "present",
        workedHours: checkOut ? 8.5 : null,
      });
    }
    for (const [i, userId] of take(halfDayCount).entries()) {
      attendanceRows.push({
        userId,
        date,
        checkIn: new Date(`${key}T03:${String(i % 30).padStart(2, "0")}:00.000Z`),
        checkOut: new Date(`${key}T07:${String(20 + (i % 20)).padStart(2, "0")}:00.000Z`),
        status: "half_day",
        workedHours: 4,
      });
    }
    for (const userId of take(absentCount)) {
      attendanceRows.push({
        userId,
        date,
        checkIn: null,
        checkOut: null,
        status: "absent",
        workedHours: 0,
      });
    }
  }

  for (let start = 0; start < attendanceRows.length; start += 200) {
    await prisma.attendance.createMany({
      data: attendanceRows.slice(start, start + 200),
      skipDuplicates: true,
    });
  }
  console.log(`Seeded attendance rows: ${attendanceRows.length}`);

  const structure = structureEarly;

  const aaravProfile = await prisma.employeeProfile.findUnique({
    where: {
      organizationId_employeeId: {
        organizationId: organization.id,
        employeeId: "ODDO-2026-008",
      },
    },
  });
  const markProfile = await prisma.employeeProfile.findUnique({
    where: {
      organizationId_employeeId: {
        organizationId: organization.id,
        employeeId: "ODDO-2026-006",
      },
    },
  });
  if (aaravProfile) {
    const computed = computePayslip(REGULAR_SALARY_RULES, {
      wage: 50000,
      workedDays: 22,
      scheduledDays: 22,
      unpaidLeaveDays: 0,
    });
    await prisma.payrun.create({
      data: {
        organizationId: organization.id,
        name: "January 2026",
        structureId: structure.id,
        periodStart: dateFromKey("2026-01-01"),
        periodEnd: dateFromKey("2026-01-31"),
        status: "paid",
        payslips: {
          create: {
            employeeId: aaravProfile.id,
            workedDays: 22,
            status: "paid",
            wage: 50000,
            gross: computed.gross,
            net: computed.net,
            lines: {
              create: computed.lines.map((line) => ({
                name: line.name,
                code: line.code,
                category: line.category,
                amount: line.amount,
              })),
            },
          },
        },
      },
    });
  }
  if (markProfile) {
    await prisma.payrun.create({
      data: {
        organizationId: organization.id,
        name: "March 2026",
        structureId: structure.id,
        periodStart: dateFromKey("2026-03-01"),
        periodEnd: dateFromKey("2026-03-31"),
        status: "draft",
        payslips: {
          create: {
            employeeId: markProfile.id,
            workedDays: 0,
            status: "draft",
            warning: "No contract for this period",
          },
        },
      },
    });
  }

  const recruitment = await seedRecruitment(prisma, organization.id);

  const hrReviewer = await prisma.employeeProfile.findFirst({
    where: { organizationId: organization.id, role: { in: ["hr_manager", "admin"] } },
    select: { id: true, userId: true },
  });
  const cycle = await prisma.performanceCycle.create({
    data: {
      organizationId: organization.id,
      name: "Q3 2026",
      periodStart: dateFromKey(daysAgo(30)),
      periodEnd: dateFromKey(daysAgo(0)),
      status: "open",
    },
  });
  const reviewEmployees = await prisma.employeeProfile.findMany({
    where: { organizationId: organization.id, status: "active", role: "employee" },
    select: { id: true, fullName: true },
    orderBy: { employeeId: "asc" },
    take: 12,
  });
  for (const [index, employee] of reviewEmployees.entries()) {
    const status = index % 3 === 0 ? "submitted" : index % 3 === 1 ? "acknowledged" : "draft";
    await prisma.performanceReview.create({
      data: {
        cycleId: cycle.id,
        employeeId: employee.id,
        reviewerId: hrReviewer?.id ?? null,
        status,
        overallRating: status === "draft" ? null : 3.5 + (index % 3) * 0.5,
        summary:
          status === "draft" ? "" : `${employee.fullName} is meeting expectations for this cycle.`,
        employeeComments: status === "acknowledged" ? "Thanks for the feedback." : "",
        submittedAt: status === "draft" ? null : now,
        acknowledgedAt: status === "acknowledged" ? now : null,
        goals: {
          create: [
            {
              title: "Delivery quality",
              description: "Ship assigned work with low rework.",
              progress: status === "draft" ? 20 : 70 + (index % 3) * 10,
              status: status === "draft" ? "in_progress" : "completed",
            },
            {
              title: "Collaboration",
              description: "Support cross-team handoffs.",
              progress: status === "draft" ? 10 : 60,
              status: "in_progress",
            },
          ],
        },
      },
    });
  }

  if (hrReviewer) {
    await prisma.notification.createMany({
      data: [
        {
          userId: hrReviewer.userId,
          title: "Leave requests need review",
          body: "Pending leave requests are waiting for a decision.",
          category: "leave",
          href: "/admin/people/leave",
        },
        {
          userId: hrReviewer.userId,
          title: "Payroll draft ready",
          body: "March 2026 payrun is still in draft.",
          category: "payroll",
          href: "/admin/hr/payroll",
        },
      ],
    });
  }

  console.log("Seed complete.");
  console.log(`Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Demo employees password: ${DEMO_PASSWORD}`);
  console.log(`Example employee: william.joseph@oddo.com`);
  console.log(`Bulk employees: ${bulk.length} (+ ${people.length} named + admin)`);
  console.log(`On-leave today (seeded): ${leaveTodayUserIds.length}`);
  console.log(`Schedules: 3 · Contracts: ${contractProfiles.length}`);
  console.log(`Recruitment: ${recruitment.jobs} jobs · ${recruitment.candidates} candidates`);
  console.log(`Performance reviews: ${reviewEmployees.length}`);
  console.log(`Seeded at ${now.toISOString()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
