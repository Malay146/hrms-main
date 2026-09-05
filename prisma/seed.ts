import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/db";
import { dateFromKey, currentPayrollMonth } from "../lib/dates";

const DEMO_PASSWORD = "Password1";

function id() {
  return crypto.randomUUID();
}

async function main() {
  await prisma.payroll.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const password = await hashPassword(DEMO_PASSWORD);
  const now = new Date();
  const month = currentPayrollMonth();

  const organization = await prisma.organization.create({
    data: {
      name: "Acme Inc.",
      email: "admin@acme.com",
      slug: "ACME",
    },
  });

  const people = [
    {
      email: "admin@acme.com",
      name: "William Joseph",
      employeeId: "ACME-2026-001",
      role: "admin" as const,
      department: "Human Resources",
      jobTitle: "HR Admin",
      phone: "+91 98765 43210",
      status: "active" as const,
      balance: 20,
      payroll: { basic: 65000, hraPct: 20, allowancePct: 10, deductions: 4000 },
    },
    {
      email: "john.cena@organization.com",
      name: "John Cena",
      employeeId: "ACME-2026-002",
      role: "employee" as const,
      department: "Engineering",
      jobTitle: "Frontend Engineer",
      phone: "+91 90000 10002",
      status: "active" as const,
      balance: 15,
      payroll: { basic: 85000, hraPct: 20, allowancePct: 12, deductions: 6500 },
    },
    {
      email: "sarah.mills@organization.com",
      name: "Sarah Mills",
      employeeId: "ACME-2026-003",
      role: "employee" as const,
      department: "HR",
      jobTitle: "HR Generalist",
      phone: "+91 90000 10003",
      status: "active" as const,
      balance: 18,
      payroll: { basic: 72000, hraPct: 18, allowancePct: 10, deductions: 4800 },
    },
    {
      email: "mark.lou@organization.com",
      name: "Mark Lou",
      employeeId: "ACME-2026-004",
      role: "employee" as const,
      department: "Sales",
      jobTitle: "Sales Executive",
      phone: "+91 90000 10004",
      status: "on_leave" as const,
      balance: 12,
      payroll: { basic: 60000, hraPct: 15, allowancePct: 8, deductions: 3500 },
    },
    {
      email: "kimi.nowa@organization.com",
      name: "Kimi Nowa",
      employeeId: "ACME-2026-005",
      role: "employee" as const,
      department: "Marketing",
      jobTitle: "Marketing Specialist",
      phone: "+91 90000 10005",
      status: "active" as const,
      balance: 19,
      payroll: { basic: 68000, hraPct: 16, allowancePct: 10, deductions: 4200 },
    },
    {
      email: "david.smith@organization.com",
      name: "David Smith",
      employeeId: "ACME-2026-006",
      role: "employee" as const,
      department: "Engineering",
      jobTitle: "Backend Architect",
      phone: "+91 90000 10006",
      status: "active" as const,
      balance: 20,
      payroll: { basic: 120000, hraPct: 25, allowancePct: 15, deductions: 9800 },
    },
    {
      email: "clara.oswald@organization.com",
      name: "Clara Oswald",
      employeeId: "ACME-2026-007",
      role: "employee" as const,
      department: "HR",
      jobTitle: "Recruiting Coordinator",
      phone: "+91 90000 10007",
      status: "on_leave" as const,
      balance: 16,
      payroll: { basic: 58000, hraPct: 14, allowancePct: 8, deductions: 3100 },
    },
    {
      email: "emma.watson@organization.com",
      name: "Emma Watson",
      employeeId: "ACME-2026-008",
      role: "employee" as const,
      department: "Marketing",
      jobTitle: "SEO Lead",
      phone: "+91 90000 10008",
      status: "inactive" as const,
      balance: 20,
      payroll: { basic: 70000, hraPct: 18, allowancePct: 10, deductions: 4500 },
    },
  ];

  const created = [];
  for (const person of people) {
    const userId = id();
    await prisma.user.create({
      data: {
        id: userId,
        name: person.name,
        email: person.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: person.role,
        accounts: {
          create: {
            id: id(),
            accountId: userId,
            providerId: "credential",
            password,
            createdAt: now,
            updatedAt: now,
          },
        },
        profile: {
          create: {
            organizationId: organization.id,
            employeeId: person.employeeId,
            fullName: person.name,
            role: person.role,
            department: person.department,
            jobTitle: person.jobTitle,
            phone: person.phone,
            status: person.status,
            paidLeaveBalance: person.balance,
          },
        },
        payrolls: {
          create: {
            month,
            basic: person.payroll.basic,
            hraPct: person.payroll.hraPct,
            allowancePct: person.payroll.allowancePct,
            deductions: person.payroll.deductions,
          },
        },
      },
    });
    created.push({ ...person, userId });
  }

  const byEmail = Object.fromEntries(created.map((person) => [person.email, person]));

  const attendanceSeeds = [
    { email: "john.cena@organization.com", date: "2026-09-01", checkIn: "08:58", checkOut: "17:02", status: "present" as const },
    { email: "john.cena@organization.com", date: "2026-09-02", checkIn: "09:20", checkOut: "17:10", status: "present" as const },
    { email: "sarah.mills@organization.com", date: "2026-09-01", checkIn: "09:00", checkOut: "17:00", status: "present" as const },
    { email: "sarah.mills@organization.com", date: "2026-09-03", checkIn: "09:05", checkOut: "13:10", status: "half_day" as const },
    { email: "kimi.nowa@organization.com", date: "2026-09-01", checkIn: "09:25", checkOut: "17:15", status: "present" as const },
    { email: "david.smith@organization.com", date: "2026-09-01", checkIn: "08:55", checkOut: "17:05", status: "present" as const },
    { email: "david.smith@organization.com", date: "2026-09-02", checkIn: null, checkOut: null, status: "absent" as const },
    { email: "mark.lou@organization.com", date: "2026-09-03", checkIn: null, checkOut: null, status: "leave" as const },
    { email: "clara.oswald@organization.com", date: "2026-09-04", checkIn: null, checkOut: null, status: "leave" as const },
    { email: "admin@acme.com", date: "2026-09-01", checkIn: "08:52", checkOut: "16:58", status: "present" as const },
  ];

  for (const row of attendanceSeeds) {
    const person = byEmail[row.email];
    await prisma.attendance.create({
      data: {
        userId: person.userId,
        date: dateFromKey(row.date),
        checkIn: row.checkIn ? new Date(`${row.date}T${row.checkIn}:00+05:30`) : null,
        checkOut: row.checkOut ? new Date(`${row.date}T${row.checkOut}:00+05:30`) : null,
        status: row.status,
      },
    });
  }

  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: byEmail["john.cena@organization.com"].userId,
        type: "paid",
        startDate: dateFromKey("2026-09-22"),
        endDate: dateFromKey("2026-09-26"),
        remarks: "Family vacation",
        status: "pending",
      },
      {
        userId: byEmail["sarah.mills@organization.com"].userId,
        type: "sick",
        startDate: dateFromKey("2026-09-03"),
        endDate: dateFromKey("2026-09-03"),
        remarks: "Medical checkup",
        status: "approved",
        adminComment: "Approved. Get well soon.",
      },
      {
        userId: byEmail["mark.lou@organization.com"].userId,
        type: "paid",
        startDate: dateFromKey("2026-09-03"),
        endDate: dateFromKey("2026-09-05"),
        remarks: "Personal travel",
        status: "approved",
        adminComment: "Approved for the sales trip wrap-up.",
      },
      {
        userId: byEmail["clara.oswald@organization.com"].userId,
        type: "unpaid",
        startDate: dateFromKey("2026-09-04"),
        endDate: dateFromKey("2026-09-05"),
        remarks: "Family emergency",
        status: "approved",
        adminComment: "Approved as unpaid leave.",
      },
      {
        userId: byEmail["emma.watson@organization.com"].userId,
        type: "sick",
        startDate: dateFromKey("2026-08-18"),
        endDate: dateFromKey("2026-08-18"),
        remarks: "Fever",
        status: "rejected",
        adminComment: "Rejected. No medical note attached.",
      },
    ],
  });

  console.log("Seeded 8 users. Demo password for every account: Password1");
  console.log("Admin: admin@acme.com");
  console.log("Employee: john.cena@organization.com");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
