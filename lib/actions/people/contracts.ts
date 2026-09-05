"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import {
  assertSingleRunning,
  type ContractWindow,
} from "@/lib/people/contract-period";
import { nextContractCode } from "@/lib/people/employee-id";
import {
  dateFromKey,
  formatDisplayDate,
  kolkataParts,
  kolkataTodayKey,
  toDateKey,
} from "@/lib/shared/dates";
import { firstZodError, upsertContractSchema } from "@/lib/shared/validations";
import {
  clampPage,
  clampPageSize,
  pageSkip,
  totalPagesFor,
  type PagedResult,
} from "@/lib/shared/pagination";
import type { ActionResult } from "@/lib/shared/types";

export type ContractListItem = {
  id: string;
  code: string;
  employeeProfileId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  jobTitle: string;
  wage: number;
  startDate: string;
  endDate: string | null;
  startLabel: string;
  endLabel: string;
  status: "running" | "expired";
  scheduleId: string | null;
  departmentId: string | null;
  salaryStructureId: string | null;
  notes: string | null;
};

export type ContractListResult = PagedResult<ContractListItem> & {
  stats: {
    total: number;
    running: number;
    expired: number;
    endingSoon: number;
    wageMonthly: number;
  };
};

export type ContractFormOptions = {
  employees: { id: string; employeeId: string; name: string; departmentId: string; jobTitle: string }[];
  departments: { id: string; name: string }[];
  schedules: { id: string; name: string }[];
  salaryStructures: { id: string; name: string }[];
};

async function expirePastContracts(organizationId?: string) {
  const today = kolkataTodayKey();
  await prisma.contract.updateMany({
    where: {
      status: "running",
      endDate: { lt: dateFromKey(today) },
      ...(organizationId
        ? { employee: { organizationId } }
        : {}),
    },
    data: { status: "expired" },
  });
}

function mapContract(row: {
  id: string;
  code: string;
  employeeId: string;
  jobTitle: string;
  wage: { toString(): string } | number;
  startDate: Date;
  endDate: Date | null;
  status: "running" | "expired";
  scheduleId: string | null;
  departmentId: string | null;
  salaryStructureId: string | null;
  notes: string | null;
  employee: { employeeId: string; fullName: string };
  department: { name: string } | null;
}): ContractListItem {
  const startDate = toDateKey(row.startDate);
  const endDate = row.endDate ? toDateKey(row.endDate) : null;
  return {
    id: row.id,
    code: row.code,
    employeeProfileId: row.employeeId,
    employeeCode: row.employee.employeeId,
    employeeName: row.employee.fullName,
    departmentName: row.department?.name ?? null,
    jobTitle: row.jobTitle,
    wage: Number(row.wage),
    startDate,
    endDate,
    startLabel: formatDisplayDate(startDate),
    endLabel: endDate ? formatDisplayDate(endDate) : "Open",
    status: row.status,
    scheduleId: row.scheduleId,
    departmentId: row.departmentId,
    salaryStructureId: row.salaryStructureId,
    notes: row.notes,
  };
}

const contractInclude = {
  employee: { select: { employeeId: true, fullName: true } },
  department: { select: { name: true } },
} as const;

function revalidateContracts(employeeCode?: string) {
  revalidatePath("/admin/people/contracts");
  if (employeeCode) {
    revalidatePath(`/admin/people/employees/${employeeCode}`);
  }
  revalidateTag("contracts", "max");
}

export async function listContracts(filters?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "running" | "expired" | "All";
  employeeCode?: string | null;
}): Promise<ActionResult<ContractListResult>> {
  try {
    const user = await requirePermission("managePeople");
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) {
      return { ok: false, error: "Your employee profile is missing." };
    }

    await expirePastContracts(profile.organizationId);

    const page = clampPage(filters?.page);
    const pageSize = clampPageSize(filters?.pageSize);
    const search = filters?.search?.trim() ?? "";
    const statusFilter = filters?.status ?? "All";

    let employeeProfileId: string | undefined;
    if (filters?.employeeCode) {
      const target = await prisma.employeeProfile.findFirst({
        where: {
          employeeId: filters.employeeCode,
          organizationId: profile.organizationId,
        },
        select: { id: true },
      });
      if (!target) {
        return {
          ok: true,
          data: {
            rows: [],
            page: 1,
            pageSize,
            total: 0,
            totalPages: 1,
            stats: { total: 0, running: 0, expired: 0, endingSoon: 0, wageMonthly: 0 },
          },
        };
      }
      employeeProfileId = target.id;
    }

    const orgScope: Prisma.ContractWhereInput = {
      employee: { organizationId: profile.organizationId },
      ...(employeeProfileId ? { employeeId: employeeProfileId } : {}),
    };

    const andFilters: Prisma.ContractWhereInput[] = [];
    if (statusFilter === "running" || statusFilter === "expired") {
      andFilters.push({ status: statusFilter });
    }
    if (search) {
      andFilters.push({
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { employee: { fullName: { contains: search, mode: "insensitive" } } },
          { employee: { employeeId: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.ContractWhereInput =
      andFilters.length === 0
        ? orgScope
        : { AND: [orgScope, ...andFilters] };

    const today = kolkataTodayKey();
    const soonEnd = new Date(dateFromKey(today).getTime() + 45 * 86_400_000);

    const [total, rows, statusGroups, endingSoon, wageAgg] = await Promise.all([
      prisma.contract.count({ where }),
      prisma.contract.findMany({
        where,
        include: contractInclude,
        orderBy: [{ status: "desc" }, { startDate: "desc" }],
        skip: pageSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.contract.groupBy({
        by: ["status"],
        where: orgScope,
        _count: { _all: true },
      }),
      prisma.contract.count({
        where: {
          ...orgScope,
          status: "running",
          endDate: { gte: dateFromKey(today), lte: soonEnd },
        },
      }),
      prisma.contract.aggregate({
        where: { ...orgScope, status: "running" },
        _sum: { wage: true },
      }),
    ]);

    const countByStatus = new Map(statusGroups.map((row) => [row.status, row._count._all]));
    const running = countByStatus.get("running") ?? 0;
    const expired = countByStatus.get("expired") ?? 0;
    const statsTotal = running + expired;

    return {
      ok: true,
      data: {
        rows: rows.map(mapContract),
        page,
        pageSize,
        total,
        totalPages: totalPagesFor(total, pageSize),
        stats: {
          total: statsTotal,
          running,
          expired,
          endingSoon,
          wageMonthly: Number(wageAgg._sum.wage ?? 0),
        },
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load contracts.") };
  }
}

export async function getContractAction(
  id: string,
): Promise<ActionResult<ContractListItem>> {
  try {
    await requirePermission("managePeople");
    await expirePastContracts();
    const row = await prisma.contract.findUnique({
      where: { id },
      include: contractInclude,
    });
    if (!row) return { ok: false, error: "Contract not found." };
    return { ok: true, data: mapContract(row) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load contract.") };
  }
}

export async function getContractFormOptions(filters?: {
  search?: string;
  employeeCode?: string | null;
}): Promise<ActionResult<ContractFormOptions>> {
  try {
    const user = await requirePermission("managePeople");
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) {
      return { ok: false, error: "Your employee profile is missing." };
    }

    const search = filters?.search?.trim() ?? "";
    const employeeWhere: Prisma.EmployeeProfileWhereInput = {
      organizationId: profile.organizationId,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { employeeId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [employees, ensureEmployee, departments, schedules, salaryStructures] =
      await Promise.all([
        prisma.employeeProfile.findMany({
          where: employeeWhere,
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            departmentId: true,
            jobTitle: true,
          },
          orderBy: { fullName: "asc" },
          take: 40,
        }),
        filters?.employeeCode
          ? prisma.employeeProfile.findFirst({
              where: {
                organizationId: profile.organizationId,
                employeeId: filters.employeeCode,
              },
              select: {
                id: true,
                employeeId: true,
                fullName: true,
                departmentId: true,
                jobTitle: true,
              },
            })
          : Promise.resolve(null),
        prisma.department.findMany({
          where: { organizationId: profile.organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.workingSchedule.findMany({
          where: { organizationId: profile.organizationId, active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.salaryStructure.findMany({
          where: { organizationId: profile.organizationId, active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ]);

    const employeeMap = new Map(employees.map((row) => [row.id, row]));
    if (ensureEmployee) employeeMap.set(ensureEmployee.id, ensureEmployee);

    return {
      ok: true,
      data: {
        employees: [...employeeMap.values()]
          .sort((a, b) => a.fullName.localeCompare(b.fullName))
          .map((row) => ({
            id: row.id,
            employeeId: row.employeeId,
            name: row.fullName,
            departmentId: row.departmentId,
            jobTitle: row.jobTitle,
          })),
        departments,
        schedules,
        salaryStructures,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load form options.") };
  }
}

export async function upsertContractAction(input: {
  id?: string;
  employeeProfileId: string;
  departmentId?: string | null;
  scheduleId?: string | null;
  salaryStructureId?: string | null;
  jobTitle: string;
  wage: number;
  startDate: string;
  endDate?: string | null;
  status: "running" | "expired";
  notes?: string | null;
}): Promise<ActionResult<ContractListItem>> {
  try {
    await requirePermission("managePeople");
    const parsed = upsertContractSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const employee = await prisma.employeeProfile.findUnique({
      where: { id: parsed.data.employeeProfileId },
      select: { id: true, organizationId: true, employeeId: true },
    });
    if (!employee) {
      return { ok: false, error: "Employee not found." };
    }

    await expirePastContracts(employee.organizationId);

    const endRaw = parsed.data.endDate && parsed.data.endDate.length > 0 ? parsed.data.endDate : null;
    const today = kolkataTodayKey();
    let status = parsed.data.status;
    if (endRaw && endRaw < today) {
      status = "expired";
    }

    const existingWindows = await prisma.contract.findMany({
      where: { employeeId: employee.id },
      select: { id: true, startDate: true, endDate: true, status: true },
    });

    const nextWindow: ContractWindow = {
      id: parsed.data.id ?? "new",
      startDate: parsed.data.startDate,
      endDate: endRaw,
      status,
    };
    const clash = assertSingleRunning(
      nextWindow,
      existingWindows.map((row) => ({
        id: row.id,
        startDate: toDateKey(row.startDate),
        endDate: row.endDate ? toDateKey(row.endDate) : null,
        status: row.status,
      })),
    );
    if (clash) {
      return { ok: false, error: clash };
    }

    let saved;
    if (parsed.data.id) {
      saved = await prisma.contract.update({
        where: { id: parsed.data.id },
        data: {
          employeeId: employee.id,
          departmentId: parsed.data.departmentId || null,
          scheduleId: parsed.data.scheduleId || null,
          salaryStructureId: parsed.data.salaryStructureId || null,
          jobTitle: parsed.data.jobTitle.trim(),
          wage: parsed.data.wage,
          startDate: dateFromKey(parsed.data.startDate),
          endDate: endRaw ? dateFromKey(endRaw) : null,
          status,
          notes: parsed.data.notes?.trim() || null,
        },
        include: contractInclude,
      });
    } else {
      const year = kolkataParts().year;
      const existingCodes = (
        await prisma.contract.findMany({
          where: { code: { startsWith: `CON/${year}/` } },
          select: { code: true },
        })
      ).map((row) => row.code);
      const code = nextContractCode(year, existingCodes);

      saved = await prisma.contract.create({
        data: {
          code,
          employeeId: employee.id,
          departmentId: parsed.data.departmentId || null,
          scheduleId: parsed.data.scheduleId || null,
          salaryStructureId: parsed.data.salaryStructureId || null,
          jobTitle: parsed.data.jobTitle.trim(),
          wage: parsed.data.wage,
          startDate: dateFromKey(parsed.data.startDate),
          endDate: endRaw ? dateFromKey(endRaw) : null,
          status,
          notes: parsed.data.notes?.trim() || null,
        },
        include: contractInclude,
      });
    }

    revalidateContracts(employee.employeeId);
    return { ok: true, data: mapContract(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save contract.") };
  }
}

export async function deleteContractAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("managePeople");
    const existing = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        employee: { select: { employeeId: true } },
      },
    });
    if (!existing) {
      return { ok: false, error: "Contract not found." };
    }

    await prisma.$transaction([
      prisma.payslip.updateMany({
        where: { contractId: id },
        data: { contractId: null },
      }),
      prisma.contract.delete({ where: { id } }),
    ]);

    revalidatePath(`/admin/people/contracts/${id}`);
    revalidateContracts(existing.employee.employeeId);
    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete contract.") };
  }
}
