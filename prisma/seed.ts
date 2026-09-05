import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/db";
import {
  currentPayrollMonth,
  dateFromKey,
  inclusiveDayCount,
  kolkataTodayKey,
} from "../lib/dates";

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
  role: "admin" | "hr_manager" | "hr_payroll_manager" | "employee";
  organizationId: string;
  departmentId: string;
  employeeId: string;
  jobTitle: string;
  phone?: string;
  passwordHash: string;
  basic: number;
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
          departmentId: opts.departmentId,
          jobTitle: opts.jobTitle,
          phone: opts.phone ?? null,
          status: "active",
          paidLeaveBalance: 20,
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
  await prisma.contract.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.timeOffAllocation.deleteMany();
  await prisma.timeOffType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.payroll.deleteMany();
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

  const departmentNames = ["Human Resources", "Engineering", "Sales", "Finance"];
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
      basic: 4800,
    },
    {
      name: "Kimi Nowa",
      email: "kimi.nowa@oddo.com",
      role: "hr_payroll_manager" as const,
      employeeId: "ODDO-2026-007",
      department: "Finance",
      jobTitle: "Payroll Manager",
      basic: 8000,
    },
  ];

  const userIds: Record<string, string> = { admin: adminId };
  for (const person of people) {
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
    });
  }

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
          checkIn: new Date(
            `${key}T${String(checkInHour).padStart(2, "0")}:${String(checkInMin).padStart(2, "0")}:00.000Z`,
          ),
          checkOut: dayOffset === 0 ? null : new Date(`${key}T17:0${index}:00.000Z`),
          status: "present",
        },
      });
    }
  }

  const leaveSeeds = [
    {
      userId: userIds["john.cena@oddo.com"],
      code: "sick",
      start: daysAgo(-2),
      end: daysAgo(-1),
      remarks: "Medical checkup",
      status: "pending" as const,
    },
    {
      userId: userIds["sarah.mills@oddo.com"],
      code: "paid",
      start: daysAgo(-10),
      end: daysAgo(-8),
      remarks: "Family vacation",
      status: "approved" as const,
      adminComment: "Approved",
    },
    {
      userId: userIds["mark.lou@oddo.com"],
      code: "unpaid",
      start: daysAgo(5),
      end: daysAgo(5),
      remarks: "Personal errand",
      status: "rejected" as const,
      adminComment: "Insufficient notice",
    },
  ];

  for (const leave of leaveSeeds) {
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
