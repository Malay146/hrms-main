import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../lib/db";
import { currentPayrollMonth } from "../lib/dates";

const ADMIN_EMAIL = "admin@oddo.com";
const ADMIN_PASSWORD = "admin@oddo@1234";

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

  const password = await hashPassword(ADMIN_PASSWORD);
  const now = new Date();
  const userId = id();

  const organization = await prisma.organization.create({
    data: {
      name: "Oddo",
      email: ADMIN_EMAIL,
      slug: "ODDO",
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      name: "Admin",
      email: ADMIN_EMAIL,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      role: "admin",
      mustChangePassword: false,
      accounts: {
        create: {
          id: id(),
          accountId: userId,
          providerId: "credential",
          issuer: "local:credential",
          password,
          createdAt: now,
          updatedAt: now,
        },
      },
      profile: {
        create: {
          organizationId: organization.id,
          employeeId: "ODDO-2026-001",
          fullName: "Admin",
          role: "admin",
          department: "Human Resources",
          jobTitle: "Administrator",
          phone: null,
          status: "active",
          paidLeaveBalance: 20,
        },
      },
      payrolls: {
        create: {
          month: currentPayrollMonth(),
          basic: 0,
          hraPct: 20,
          allowancePct: 10,
          deductions: 0,
        },
      },
    },
  });

  console.log("Seeded the admin account only.");
  console.log(`Admin: ${ADMIN_EMAIL}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
