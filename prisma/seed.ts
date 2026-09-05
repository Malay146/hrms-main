import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/db";
import { currentPayrollMonth, dateFromKey, kolkataTodayKey } from "../lib/dates";
import { computePayslip } from "../lib/payroll/compute";
import { REGULAR_SALARY_RULES } from "../lib/payroll/regular-salary";

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

async function createUser(opts: {
  name: string;
  email: string;
  role: "admin" | "hr_manager" | "hr_payroll_user" | "hr_payroll_manager" | "employee";
  organizationId: string;
  employeeId: string;
  department: string;
  jobTitle: string;
  phone?: string;
  passwordHash: string;
  basic: number;
  wage?: number | null;
  bankAccount?: string | null;
  employeeType?: "full_time" | "intern" | "contractor";
  mustChangePassword?: boolean;
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
          department: opts.department,
          jobTitle: opts.jobTitle,
          phone: opts.phone ?? null,
          status: "active",
          paidLeaveBalance: 20,
          employeeType: opts.employeeType ?? "full_time",
          bankAccount: opts.bankAccount ?? null,
          wage: opts.wage ?? (opts.basic || null),
        },
      },
      payrolls: {
        create: {
          month: currentPayrollMonth(),
          basic: opts.basic,
          hraPct: 20,
          allowancePct: 10,
          deductions: Math.round(opts.basic * 0.05),
        },
      },
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
  await prisma.payroll.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.aiInsight.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.employeeProfile.deleteMany();
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

  const adminId = await createUser({
    name: "Admin",
    email: ADMIN_EMAIL,
    role: "admin",
    organizationId: organization.id,
    employeeId: "ODDO-2026-001",
    department: "Human Resources",
    jobTitle: "Administrator",
    passwordHash: adminHash,
    basic: 0,
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
  for (const person of people) {
    userIds[person.email] = await createUser({
      ...person,
      organizationId: organization.id,
      passwordHash: demoHash,
    });
  }

  // Attendance for the last few weekdays
  const attendees = [
    userIds["william.joseph@oddo.com"],
    userIds["bruce.banner@oddo.com"],
    userIds["sarah.mills@oddo.com"],
    userIds["john.cena@oddo.com"],
    userIds["kimi.nowa@oddo.com"],
  ];

  for (const dayOffset of [0, 1, 2, 3, 4]) {
    const key = daysAgo(dayOffset);
    for (const [index, userId] of attendees.entries()) {
      const late = index === 3 && dayOffset === 1;
      const checkInHour = late ? 9 : 8;
      const checkInMin = late ? 25 : 52 + index;
      await prisma.attendance.create({
        data: {
          userId,
          date: dateFromKey(key),
          checkIn: new Date(`${key}T${String(checkInHour).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}:00.000Z`),
          checkOut:
            dayOffset === 0
              ? null
              : new Date(`${key}T17:0${index}:00.000Z`),
          status: "present",
        },
      });
    }
  }

  // Leave requests
  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: userIds["john.cena@oddo.com"],
        type: "sick",
        startDate: dateFromKey(daysAgo(-2)),
        endDate: dateFromKey(daysAgo(-1)),
        remarks: "Medical checkup",
        status: "pending",
      },
      {
        userId: userIds["sarah.mills@oddo.com"],
        type: "paid",
        startDate: dateFromKey(daysAgo(-10)),
        endDate: dateFromKey(daysAgo(-8)),
        remarks: "Family vacation",
        status: "approved",
        adminComment: "Approved",
      },
      {
        userId: userIds["mark.lou@oddo.com"],
        type: "unpaid",
        startDate: dateFromKey(daysAgo(5)),
        endDate: dateFromKey(daysAgo(5)),
        remarks: "Personal errand",
        status: "rejected",
        adminComment: "Insufficient notice",
      },
      // AI Analytics demo: overlapping Engineering leave for clash detection
      {
        userId: userIds["bruce.banner@oddo.com"],
        type: "paid",
        startDate: dateFromKey(daysAgo(1)),
        endDate: dateFromKey(daysAgo(-1)),
        remarks: "On-site workshop with the frontend team",
        status: "approved",
        adminComment: "Approved",
      },
      {
        userId: userIds["john.cena@oddo.com"],
        type: "paid",
        startDate: dateFromKey(daysAgo(1)),
        endDate: dateFromKey(daysAgo(-1)),
        remarks: "Family in town overlapping the workshop week",
        status: "pending",
      },
    ],
  });

  const structure = await prisma.salaryStructure.create({
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
    include: { rules: true },
  });

  const aaravProfile = await prisma.employeeProfile.findUnique({
    where: { employeeId: "ODDO-2026-008" },
  });
  const markProfile = await prisma.employeeProfile.findUnique({
    where: { employeeId: "ODDO-2026-006" },
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

  console.log("Seed complete.");
  console.log(`Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Demo employees password: ${DEMO_PASSWORD}`);
  console.log(`Example employee: william.joseph@oddo.com`);
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
