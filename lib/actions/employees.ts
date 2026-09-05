"use server";

import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { nextEmployeeId } from "@/lib/employee-id";
import { logger } from "@/lib/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/session";
import { mapEmployee } from "@/lib/mappers";
import { kolkataParts, kolkataTodayKey, currentPayrollMonth } from "@/lib/dates";
import { createEmployeeSchema, firstZodError } from "@/lib/validations";
import { departmentCodeFromName } from "@/lib/department-code";
import { generateTemporaryPassword, sendAccountCredentialsEmail } from "@/lib/mail";
import type { ActionResult, EmployeeListItem, Role } from "@/lib/types";

function randomId() {
  return crypto.randomUUID();
}

export async function listEmployees(): Promise<ActionResult<EmployeeListItem[]>> {
  try {
    await requirePermission("managePeople");
    const today = kolkataTodayKey();
    const [profiles, leavesToday] = await Promise.all([
      prisma.employeeProfile.findMany({
        include: {
          user: { select: { email: true } },
          department: { select: { name: true } },
        },
        orderBy: { employeeId: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "approved",
          startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
          endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
        },
        select: { userId: true },
      }),
    ]);

    const onLeave = new Set(leavesToday.map((leave) => leave.userId));
    return {
      ok: true,
      data: profiles.map((profile) => mapEmployee(profile, onLeave.has(profile.userId))),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load employees.") };
  }
}

export async function getEmployeeByCode(employeeId: string): Promise<ActionResult<EmployeeListItem>> {
  try {
    await requirePermission("managePeople");
    const profile = await prisma.employeeProfile.findUnique({
      where: { employeeId },
      include: {
        user: { select: { email: true } },
        department: { select: { name: true } },
      },
    });
    if (!profile) {
      return { ok: false, error: "Employee not found." };
    }
    const today = kolkataTodayKey();
    const onLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: profile.userId,
        status: "approved",
        startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
        endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
      },
    });
    return { ok: true, data: mapEmployee(profile, Boolean(onLeave)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load employee.") };
  }
}

export async function createEmployeeAction(input: {
  fullName: string;
  email: string;
  role: Role;
  department: string;
  jobTitle: string;
  phone?: string;
}): Promise<ActionResult<{ employeeId: string; emailSent: boolean; temporaryPassword?: string }>> {
  try {
    const admin = await requirePermission("createUsers");
    const parsed = createEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const duplicate = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (duplicate) {
      return { ok: false, error: "An account with this email already exists." };
    }

    const adminProfile = await prisma.employeeProfile.findUnique({
      where: { userId: admin.id },
      include: { organization: true },
    });
    if (!adminProfile) {
      return { ok: false, error: "Admin profile is missing." };
    }

    const year = kolkataParts().year;
    const existingIds = (
      await prisma.employeeProfile.findMany({
        where: { organizationId: adminProfile.organizationId },
        select: { employeeId: true },
      })
    ).map((row) => row.employeeId);
    const employeeId = nextEmployeeId(adminProfile.organization.slug, year, existingIds);
    const password = generateTemporaryPassword();
    const now = new Date();
    const userId = randomId();
    const passwordHash = await hashPassword(password);

    const deptName = parsed.data.department.trim();
    const deptCode = departmentCodeFromName(deptName);

    await prisma.$transaction(async (tx) => {
      const department = await tx.department.upsert({
        where: {
          organizationId_code: {
            organizationId: adminProfile.organizationId,
            code: deptCode,
          },
        },
        create: {
          organizationId: adminProfile.organizationId,
          name: deptName,
          code: deptCode,
        },
        update: { name: deptName },
      });

      await tx.user.create({
        data: {
          id: userId,
          name: parsed.data.fullName,
          email: parsed.data.email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          role: parsed.data.role,
          mustChangePassword: true,
          accounts: {
            create: {
              id: randomId(),
              accountId: userId,
              providerId: "credential",
              issuer: "local:credential",
              password: passwordHash,
              createdAt: now,
              updatedAt: now,
            },
          },
        },
      });

      await tx.employeeProfile.create({
        data: {
          userId,
          organizationId: adminProfile.organizationId,
          employeeId,
          fullName: parsed.data.fullName,
          role: parsed.data.role,
          departmentId: department.id,
          jobTitle: parsed.data.jobTitle,
          phone: parsed.data.phone || null,
          status: "active",
          paidLeaveBalance: 20,
        },
      });

      await tx.payroll.create({
        data: {
          userId,
          month: currentPayrollMonth(),
          basic: 0,
          hraPct: 20,
          allowancePct: 10,
          deductions: 0,
        },
      });
    });

    const loginUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    let emailSent = true;
    try {
      await sendAccountCredentialsEmail({
        to: parsed.data.email,
        fullName: parsed.data.fullName,
        username: parsed.data.email,
        password,
        loginUrl: `${loginUrl.replace(/\/$/, "")}/login`,
      });
    } catch (error) {
      emailSent = false;
      logger.error("mail.credentials_failed", {
        employeeId,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }

    logger.info("employee.created", { employeeId, adminId: admin.id, role: parsed.data.role, emailSent });
    revalidatePath("/admin");
    revalidatePath("/admin/people/employees");
    return {
      ok: true,
      data: {
        employeeId,
        emailSent,
        temporaryPassword: emailSent ? undefined : password,
      },
    };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { ok: false, error: "Duplicate email or employee ID." };
    }
    return { ok: false, error: actionErrorMessage(error, "Could not create employee.") };
  }
}

export async function getProfileAction() {
  try {
    const user = await requireUser();
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      include: { user: { select: { email: true, createdAt: true } } },
    });
    if (!profile) {
      return { ok: false as const, error: "Profile not found." };
    }
    return {
      ok: true as const,
      data: mapEmployee(profile, profile.status === "on_leave"),
    };
  } catch (error) {
    return { ok: false as const, error: actionErrorMessage(error, "Could not load profile.") };
  }
}

