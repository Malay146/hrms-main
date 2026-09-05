"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { nextEmployeeId } from "@/lib/people/employee-id";
import { logger } from "@/lib/shared/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { mapEmployee } from "@/lib/shared/mappers";
import { kolkataParts, kolkataTodayKey, currentPayrollMonth, dateFromKey, toDateKey } from "@/lib/shared/dates";
import { createEmployeeSchema, firstZodError, updateEmployeeSchema } from "@/lib/shared/validations";
import { departmentCodeFromName } from "@/lib/people/department-code";
import { generateTemporaryPassword, sendAccountCredentialsEmail } from "@/lib/shared/mail";
import { createNotifications, staffUserIds } from "@/lib/shared/notify";
import { initialsFromName } from "@/lib/people/employee-id";
import { mapSheetRowsToEmployeeImports } from "@/lib/people/employee-import";
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

export type EmployeeSortKey =
  | "name"
  | "department"
  | "designation"
  | "joined"
  | "status"
  | "employeeId";

export type EmployeeListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  department?: string;
  status?: string;
  sort?: EmployeeSortKey;
  dir?: "asc" | "desc";
};

export type EmployeeListResult = {
  employees: EmployeeListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  departments: string[];
  sort: EmployeeSortKey;
  dir: "asc" | "desc";
  stats: {
    total: number;
    active: number;
    onLeave: number;
    inactive: number;
    removedInactiveCount: number;
  };
};

export type UpdateEmployeeResult =
  | { kind: "updated"; employee: EmployeeHubRecord }
  | { kind: "deactivated"; employeeId: string };

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

function clampPageSize(value: number | undefined) {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

async function loadOnLeaveUserIds(organizationId: string, today: string) {
  const rows = await prisma.leaveRequest.findMany({
    where: {
      status: "approved",
      startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
      endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
      user: { profile: { organizationId } },
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

async function loadEmployeeStats(organizationId: string, today: string) {
  const onLeaveIds = await loadOnLeaveUserIds(organizationId, today);
  const [org, total, inactive, onLeaveStatus, activeRows] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { inactiveEmployeeCount: true },
    }),
    prisma.employeeProfile.count({ where: { organizationId } }),
    prisma.employeeProfile.count({ where: { organizationId, status: "inactive" } }),
    prisma.employeeProfile.count({ where: { organizationId, status: "on_leave" } }),
    prisma.employeeProfile.findMany({
      where: { organizationId, status: "active" },
      select: { userId: true },
    }),
  ]);

  const onLeaveSet = new Set(onLeaveIds);
  const activeOnLeave = activeRows.filter((row) => onLeaveSet.has(row.userId)).length;
  const onLeave = onLeaveStatus + activeOnLeave;
  const active = Math.max(0, activeRows.length - activeOnLeave);
  const removedInactiveCount = org?.inactiveEmployeeCount ?? 0;

  return {
    total: total + removedInactiveCount,
    active,
    onLeave,
    inactive: inactive + removedInactiveCount,
    removedInactiveCount,
    onLeaveIds,
  };
}

const getCachedEmployeeStats = unstable_cache(
  async (organizationId: string, today: string) => loadEmployeeStats(organizationId, today),
  ["employee-directory-stats"],
  { revalidate: 30, tags: ["employees"] },
);

function bumpEmployeesCache() {
  revalidateTag("employees", "max");
}

function parseEmployeeSort(sort?: string): EmployeeSortKey {
  switch (sort) {
    case "department":
    case "designation":
    case "joined":
    case "status":
    case "employeeId":
    case "name":
      return sort;
    default:
      return "name";
  }
}

function parseSortDir(dir?: string): "asc" | "desc" {
  return dir === "desc" ? "desc" : "asc";
}

function employeeOrderBy(
  sort: EmployeeSortKey,
  dir: "asc" | "desc",
): Prisma.EmployeeProfileOrderByWithRelationInput[] {
  switch (sort) {
    case "department":
      return [{ department: { name: dir } }, { fullName: "asc" }];
    case "designation":
      return [{ jobTitle: dir }, { fullName: "asc" }];
    case "joined":
      return [{ joinDate: dir }, { fullName: "asc" }];
    case "status":
      return [{ status: dir }, { fullName: "asc" }];
    case "employeeId":
      return [{ employeeId: dir }];
    case "name":
    default:
      return [{ fullName: dir }, { employeeId: "asc" }];
  }
}

export async function listEmployees(
  query: EmployeeListQuery = {},
): Promise<ActionResult<EmployeeListResult>> {
  try {
    const viewer = await requirePermission("managePeople");
    const today = kolkataTodayKey();
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = clampPageSize(query.pageSize);
    const search = query.search?.trim() ?? "";
    const department = query.department?.trim() || "All";
    const status = query.status?.trim() || "All";
    const sort = parseEmployeeSort(query.sort);
    const dir = parseSortDir(query.dir);

    const orgProfile = await prisma.employeeProfile.findUnique({
      where: { userId: viewer.id },
      select: { organizationId: true },
    });
    if (!orgProfile) {
      return { ok: false, error: "Organization not found." };
    }
    const { organizationId } = orgProfile;

    const stats = await getCachedEmployeeStats(organizationId, today);
    const onLeaveSet = new Set(stats.onLeaveIds);

    const departments = (
      await prisma.department.findMany({
        where: { organizationId },
        select: { name: true },
        orderBy: { name: "asc" },
      })
    ).map((row) => row.name);

    const andFilters: Prisma.EmployeeProfileWhereInput[] = [];

    if (department !== "All") {
      andFilters.push({ department: { name: department } });
    }

    if (search) {
      andFilters.push({
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { employeeId: { contains: search, mode: "insensitive" } },
          { user: { email: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (status === "Inactive") {
      andFilters.push({ status: "inactive" });
    } else if (status === "On Leave") {
      andFilters.push({
        OR: [
          { status: "on_leave" },
          ...(stats.onLeaveIds.length > 0
            ? [{ status: "active" as const, userId: { in: stats.onLeaveIds } }]
            : []),
        ],
      });
    } else if (status === "Active") {
      andFilters.push({
        status: "active",
        ...(stats.onLeaveIds.length > 0 ? { userId: { notIn: stats.onLeaveIds } } : {}),
      });
    }

    const where: Prisma.EmployeeProfileWhereInput = {
      organizationId,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const [total, profiles] = await Promise.all([
      prisma.employeeProfile.count({ where }),
      prisma.employeeProfile.findMany({
        where,
        include: {
          user: { select: { email: true } },
          department: { select: { name: true } },
        },
        orderBy: employeeOrderBy(sort, dir),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      ok: true,
      data: {
        employees: profiles.map((profile) =>
          mapEmployee(profile, onLeaveSet.has(profile.userId)),
        ),
        page,
        pageSize,
        total,
        totalPages,
        departments,
        sort,
        dir,
        stats: {
          total: stats.total,
          active: stats.active,
          onLeave: stats.onLeave,
          inactive: stats.inactive,
          removedInactiveCount: stats.removedInactiveCount,
        },
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load employees.") };
  }
}

export async function getEmployeeByCode(employeeId: string): Promise<ActionResult<EmployeeListItem>> {
  try {
    await requirePermission("managePeople");
    const profile = await prisma.employeeProfile.findFirst({
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
    const profile = await prisma.employeeProfile.findFirst({
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
}): Promise<ActionResult<UpdateEmployeeResult>> {
  try {
    const actor = await requirePermission("managePeople");
    const parsed = updateEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const existing = await prisma.employeeProfile.findFirst({
      where: { employeeId: parsed.data.employeeId },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        status: true,
        role: true,
      },
    });
    if (!existing) {
      return { ok: false, error: "Employee not found." };
    }

    if (parsed.data.status === "inactive") {
      if (existing.userId === actor.id) {
        return { ok: false, error: "You cannot deactivate your own account." };
      }

      await prisma.$transaction(async (tx) => {
        await tx.employeeProfile.updateMany({
          where: { managerId: existing.id },
          data: { managerId: null },
        });
        await tx.organization.update({
          where: { id: existing.organizationId },
          data: { inactiveEmployeeCount: { increment: 1 } },
        });
        // Cascades profile, contracts, allocations, payslips, attendance, leave, sessions, accounts.
        await tx.user.delete({ where: { id: existing.userId } });
      });

      logger.info("employee.deactivated_deleted", {
        employeeId: parsed.data.employeeId,
        by: actor.id,
      });
      revalidatePath("/admin");
      revalidatePath("/admin/people/employees");
      bumpEmployeesCache();
      revalidatePath("/admin/users");
      return {
        ok: true,
        data: { kind: "deactivated", employeeId: parsed.data.employeeId },
      };
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
    bumpEmployeesCache();
    revalidatePath(`/admin/people/employees/${parsed.data.employeeId}`);

    const hub = await getEmployeeHub(parsed.data.employeeId);
    if (!hub.ok) {
      return { ok: false, error: hub.error };
    }
    return { ok: true, data: { kind: "updated", employee: hub.data.employee } };
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
    await createNotifications({
      userIds: [userId],
      title: "Welcome to HRMS",
      body: "Your account is ready. Sign in with the credentials sent to your email.",
      category: "system",
      href: "/employee",
    });
    await createNotifications({
      userIds: await staffUserIds(adminProfile.organizationId, admin.id),
      title: "New employee added",
      body: `${parsed.data.fullName} joined as ${parsed.data.jobTitle}.`,
      category: "system",
      href: `/admin/people/employees/${employeeId}`,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/people/employees");
    bumpEmployeesCache();
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

export type EmployeeImportResult = {
  created: number;
  failed: number;
  errors: string[];
  createdRows: { employeeId: string; email: string; temporaryPassword: string }[];
};

const MAX_IMPORT_ROWS = 200;

export async function importEmployeesFromSpreadsheetAction(input: {
  fileName: string;
  base64: string;
}): Promise<ActionResult<EmployeeImportResult>> {
  try {
    const admin = await requirePermission("createUsers");
    if (!input.base64?.trim()) {
      return { ok: false, error: "No file data received." };
    }

    const buffer = Buffer.from(input.base64, "base64");
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { ok: false, error: "The spreadsheet has no sheets." };
    }
    const sheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    if (records.length === 0) {
      return { ok: false, error: "No data rows found. Add a header row and at least one employee." };
    }
    if (records.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        error: `Too many rows (${records.length}). Import up to ${MAX_IMPORT_ROWS} at a time.`,
      };
    }

    const mapped = mapSheetRowsToEmployeeImports(records);
    const errors = [...mapped.errors];
    if (mapped.rows.length === 0) {
      return {
        ok: false,
        error:
          errors[0] ??
          "Could not map columns. Use headers like Full Name, Email, Department, Job Title (Role and Phone optional).",
      };
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

    const createdRows: EmployeeImportResult["createdRows"] = [];
    const usedEmails = new Set<string>();

    for (const row of mapped.rows) {
      const parsed = createEmployeeSchema.safeParse({
        fullName: row.fullName,
        email: row.email,
        role: row.role,
        department: row.department,
        jobTitle: row.jobTitle,
        phone: row.phone,
      });
      if (!parsed.success) {
        errors.push(`Row ${row.rowNumber}: ${firstZodError(parsed.error)}`);
        continue;
      }

      const emailKey = parsed.data.email.toLowerCase();
      if (usedEmails.has(emailKey)) {
        errors.push(`Row ${row.rowNumber}: duplicate email in this file (${parsed.data.email}).`);
        continue;
      }

      const duplicate = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (duplicate) {
        errors.push(`Row ${row.rowNumber}: account already exists for ${parsed.data.email}.`);
        continue;
      }

      usedEmails.add(emailKey);
      const employeeId = nextEmployeeId(
        adminProfile.organization.slug,
        year,
        [...existingIds, ...createdRows.map((item) => item.employeeId)],
      );
      const password = generateTemporaryPassword();
      const now = new Date();
      const userId = randomId();
      const passwordHash = await hashPassword(password);
      const deptName = parsed.data.department.trim();
      const deptCode = departmentCodeFromName(deptName);

      try {
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

        createdRows.push({
          employeeId,
          email: parsed.data.email,
          temporaryPassword: password,
        });
      } catch (error) {
        errors.push(
          `Row ${row.rowNumber}: ${
            error instanceof Error ? error.message : "could not create user"
          }`,
        );
      }
    }

    logger.info("employee.import", {
      fileName: input.fileName,
      created: createdRows.length,
      failed: errors.length,
      adminId: admin.id,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/people/employees");
    bumpEmployeesCache();
    revalidatePath("/admin/people/department");

    return {
      ok: true,
      data: {
        created: createdRows.length,
        failed: errors.length,
        errors: errors.slice(0, 40),
        createdRows,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not import spreadsheet."),
    };
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

