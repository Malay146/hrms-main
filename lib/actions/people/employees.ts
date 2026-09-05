"use server";

import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { nextEmployeeId } from "@/lib/people/employee-id";
import { logger } from "@/lib/shared/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { mapEmployee } from "@/lib/shared/mappers";
import { kolkataParts, kolkataTodayKey, currentPayrollMonth, dateFromKey, toDateKey } from "@/lib/shared/dates";
import { createEmployeeSchema, firstZodError, updateEmployeeSchema } from "@/lib/shared/validations";
import { departmentCodeFromName } from "@/lib/people/department-code";
import { generateTemporaryPassword, sendAccountCredentialsEmail } from "@/lib/shared/mail";
import { initialsFromName } from "@/lib/people/employee-id";
import type { ActionResult, EmployeeListItem, EmployeeStatus, Role } from "@/lib/shared/types";

function randomId() {
  return crypto.randomUUID();
}

export type EmployeeHubRecord = {
  profileId: string;
  userId: string;
  employeeId: string;
  fullName: string;
  email: string;
  avatar: string;
  statusLabel: string;
  departmentId: string;
  departmentName: string;
  managerId: string | null;
  scheduleId: string | null;
  jobTitle: string;
  companyName: string | null;
  workLocation: string | null;
  employeeType: "full_time" | "intern" | "contractor";
  status: EmployeeStatus;
  phone: string | null;
  personalEmail: string | null;
  address: string | null;
  bankAccount: string | null;
  joinDate: string | null;
  counts: {
    contracts: number;
    attendance: number;
    leave: number;
    allocations: number;
  };
};

export type EmployeeHubOptions = {
  departments: { id: string; name: string }[];
  managers: { id: string; name: string; employeeId: string }[];
  schedules: { id: string; name: string }[];
};

export type EmployeeHubData = {
  employee: EmployeeHubRecord;
  options: EmployeeHubOptions;
};

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

export async function getEmployeeHub(
  employeeCode: string,
): Promise<ActionResult<EmployeeHubData>> {
  try {
    await requirePermission("managePeople");
    const today = kolkataTodayKey();
    const profile = await prisma.employeeProfile.findUnique({
      where: { employeeId: employeeCode },
      include: {
        user: { select: { email: true } },
        department: { select: { id: true, name: true } },
        _count: {
          select: {
            contracts: true,
            allocations: true,
          },
        },
      },
    });
    if (!profile) {
      return { ok: false, error: "Employee not found." };
    }

    const [onLeave, attendanceCount, leaveCount, departments, managers, schedules] =
      await Promise.all([
        prisma.leaveRequest.findFirst({
          where: {
            userId: profile.userId,
            status: "approved",
            startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
            endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
          },
        }),
        prisma.attendance.count({ where: { userId: profile.userId } }),
        prisma.leaveRequest.count({ where: { userId: profile.userId } }),
        prisma.department.findMany({
          where: { organizationId: profile.organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.employeeProfile.findMany({
          where: {
            organizationId: profile.organizationId,
            id: { not: profile.id },
            status: { not: "inactive" },
          },
          select: { id: true, fullName: true, employeeId: true },
          orderBy: { fullName: "asc" },
        }),
        prisma.workingSchedule.findMany({
          where: { organizationId: profile.organizationId, active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);

    const statusLabel =
      profile.status === "inactive"
        ? "Inactive"
        : onLeave || profile.status === "on_leave"
          ? "On Leave"
          : "Active";

    return {
      ok: true,
      data: {
        employee: {
          profileId: profile.id,
          userId: profile.userId,
          employeeId: profile.employeeId,
          fullName: profile.fullName,
          email: profile.user.email,
          avatar: initialsFromName(profile.fullName),
          statusLabel,
          departmentId: profile.departmentId,
          departmentName: profile.department.name,
          managerId: profile.managerId,
          scheduleId: profile.scheduleId,
          jobTitle: profile.jobTitle,
          companyName: profile.companyName,
          workLocation: profile.workLocation,
          employeeType: profile.employeeType,
          status: profile.status,
          phone: profile.phone,
          personalEmail: profile.personalEmail,
          address: profile.address,
          bankAccount: profile.bankAccount,
          joinDate: profile.joinDate ? toDateKey(profile.joinDate) : null,
          counts: {
            contracts: profile._count.contracts,
            attendance: attendanceCount,
            leave: leaveCount,
            allocations: profile._count.allocations,
          },
        },
        options: {
          departments,
          managers: managers.map((row) => ({
            id: row.id,
            name: row.fullName,
            employeeId: row.employeeId,
          })),
          schedules,
        },
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load employee hub.") };
  }
}

export async function updateEmployeeAction(input: {
  employeeId: string;
  fullName: string;
  departmentId: string;
  managerId?: string | null;
  scheduleId?: string | null;
  jobTitle: string;
  companyName?: string | null;
  workLocation?: string | null;
  employeeType: "full_time" | "intern" | "contractor";
  status: EmployeeStatus;
  phone?: string | null;
  personalEmail?: string | null;
  address?: string | null;
  bankAccount?: string | null;
  joinDate?: string | null;
}): Promise<ActionResult<EmployeeHubRecord>> {
  try {
    await requirePermission("managePeople");
    const parsed = updateEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const existing = await prisma.employeeProfile.findUnique({
      where: { employeeId: parsed.data.employeeId },
      select: { id: true, organizationId: true, userId: true },
    });
    if (!existing) {
      return { ok: false, error: "Employee not found." };
    }

    if (parsed.data.managerId === existing.id) {
      return { ok: false, error: "An employee cannot be their own manager." };
    }

    const department = await prisma.department.findFirst({
      where: { id: parsed.data.departmentId, organizationId: existing.organizationId },
    });
    if (!department) {
      return { ok: false, error: "Department not found in your organization." };
    }

    if (parsed.data.managerId) {
      const manager = await prisma.employeeProfile.findFirst({
        where: {
          id: parsed.data.managerId,
          organizationId: existing.organizationId,
        },
      });
      if (!manager) {
        return { ok: false, error: "Manager not found in your organization." };
      }
    }

    if (parsed.data.scheduleId) {
      const schedule = await prisma.workingSchedule.findFirst({
        where: {
          id: parsed.data.scheduleId,
          organizationId: existing.organizationId,
        },
      });
      if (!schedule) {
        return { ok: false, error: "Schedule not found in your organization." };
      }
    }

    const joinDateRaw = parsed.data.joinDate;
    const joinDate =
      joinDateRaw && joinDateRaw.length > 0 ? dateFromKey(joinDateRaw) : null;
    const personalEmail =
      parsed.data.personalEmail && parsed.data.personalEmail.length > 0
        ? parsed.data.personalEmail
        : null;

    await prisma.$transaction(async (tx) => {
      await tx.employeeProfile.update({
        where: { id: existing.id },
        data: {
          fullName: parsed.data.fullName.trim(),
          departmentId: parsed.data.departmentId,
          managerId: parsed.data.managerId || null,
          scheduleId: parsed.data.scheduleId || null,
          jobTitle: parsed.data.jobTitle.trim(),
          companyName: parsed.data.companyName?.trim() || null,
          workLocation: parsed.data.workLocation?.trim() || null,
          employeeType: parsed.data.employeeType,
          status: parsed.data.status,
          phone: parsed.data.phone?.trim() || null,
          personalEmail,
          address: parsed.data.address?.trim() || null,
          bankAccount: parsed.data.bankAccount?.trim() || null,
          joinDate,
        },
      });
      await tx.user.update({
        where: { id: existing.userId },
        data: { name: parsed.data.fullName.trim() },
      });
    });

    logger.info("employee.updated", { employeeId: parsed.data.employeeId });
    revalidatePath("/admin");
    revalidatePath("/admin/people/employees");
    revalidatePath(`/admin/people/employees/${parsed.data.employeeId}`);

    const hub = await getEmployeeHub(parsed.data.employeeId);
    if (!hub.ok) {
      return { ok: false, error: hub.error };
    }
    return { ok: true, data: hub.data.employee };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not update employee.") };
  }
}

export async function createEmployeeAction(input: {
  fullName: string;
  email: string;
  role: Role;
  department: string;
  jobTitle: string;
  phone?: string;
}): Promise<ActionResult<{ employeeId: string; emailSent: boolean; emailError?: string; temporaryPassword?: string }>> {
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
    let emailError: string | undefined;
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
      emailError = error instanceof Error ? error.message : "unknown";
      logger.error("mail.credentials_failed", {
        employeeId,
        reason: emailError,
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
        emailError,
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
      include: {
        user: { select: { email: true, createdAt: true } },
        department: { select: { name: true } },
      },
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

