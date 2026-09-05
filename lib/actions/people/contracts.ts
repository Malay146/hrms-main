"use server";

import { revalidatePath } from "next/cache";
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

export async function listContracts(filters?: {
  employeeCode?: string | null;
}): Promise<ActionResult<ContractListItem[]>> {
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
        return { ok: true, data: [] };
      }
      employeeProfileId = target.id;
    }

    const rows = await prisma.contract.findMany({
      where: {
        employee: { organizationId: profile.organizationId },
        ...(employeeProfileId ? { employeeId: employeeProfileId } : {}),
      },
      include: contractInclude,
      orderBy: [{ status: "desc" }, { startDate: "desc" }],
    });

    return { ok: true, data: rows.map(mapContract) };
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

export async function getContractFormOptions(): Promise<ActionResult<ContractFormOptions>> {
  try {
    const user = await requirePermission("managePeople");
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) {
      return { ok: false, error: "Your employee profile is missing." };
    }

    const [employees, departments, schedules, salaryStructures] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: { organizationId: profile.organizationId },
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          departmentId: true,
          jobTitle: true,
        },
        orderBy: { fullName: "asc" },
      }),
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

    return {
      ok: true,
      data: {
        employees: employees.map((row) => ({
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

    revalidatePath("/admin/people/contracts");
    revalidatePath(`/admin/people/employees/${employee.employeeId}`);
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

    revalidatePath("/admin/people/contracts");
    revalidatePath(`/admin/people/contracts/${id}`);
    revalidatePath(`/admin/people/employees/${existing.employee.employeeId}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete contract.") };
  }
}
