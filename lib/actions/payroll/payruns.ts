"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { dateFromKey, payslipIssueMonth, toDateKey } from "@/lib/shared/dates";
import { stubHasContract, stubWage } from "@/lib/payroll/period-wage";
import { ensureRegularSalaryStructure } from "@/lib/actions/payroll/salary";
import {
  deliverUnsentPayslip,
  emailPayslipNow,
  issueMonthEndPayslips,
  payslipEmailInclude,
} from "@/lib/payroll/deliver-payslips";
import type { ActionResult } from "@/lib/shared/types";
import { clampPage, clampPageSize, pageSkip, totalPagesFor } from "@/lib/shared/pagination";
import { z } from "zod";
import { firstZodError } from "@/lib/shared/validations";

type EmployeeType = "full_time" | "intern" | "contractor";
type PayrunStatus = "draft" | "computed" | "validated" | "paid";
type PayslipStatus = "draft" | "computed" | "validated" | "paid";
type SalaryCategory = "basic" | "allowance" | "gross" | "deduction" | "net" | "contribution";

const createSchema = z.object({
  name: z.string().trim().min(2),
  structureId: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeType: z.enum(["full_time", "intern", "contractor"]).optional().nullable(),
  employeeIds: z.array(z.string().min(1)).min(1, "Select at least one employee."),
});

export type EligibleEmployee = {
  id: string;
  userId: string;
  name: string;
  email: string;
  employeeId: string;
  department: string;
  employeeType: EmployeeType;
  wage: number;
  bankAccount: string | null;
  hasContract: boolean;
};

export type PayrunListItem = {
  id: string;
  name: string;
  structureName: string;
  periodStart: string;
  periodEnd: string;
  status: PayrunStatus;
  employeeCount: number;
  warningCount: number;
};

export type PayslipListItem = {
  id: string;
  payrunId: string;
  payrunName: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  email: string;
  periodStart: string;
  periodEnd: string;
  structureName: string;
  status: PayslipStatus;
  workedDays: number;
  wage: number;
  gross: number;
  net: number;
  warning: string | null;
  sentAt: string | null;
  basic: number;
  allowances: number;
  deductions: number;
};

export type PayslipDetail = PayslipListItem & {
  lines: { name: string; code: string; category: SalaryCategory; amount: number }[];
};

export type PayrunDetail = PayrunListItem & {
  structureId: string;
  employeeType: EmployeeType | null;
  payslips: PayslipListItem[];
};

function revalidatePayroll(payrunId?: string) {
  revalidatePath("/admin/hr/payroll");
  revalidatePath("/admin/hr/payroll/payslips");
  revalidatePath("/admin");
  revalidatePath("/employee/payroll");
  if (payrunId) revalidatePath(`/admin/hr/payroll/${payrunId}`);
  revalidateTag("payroll", "max");
}

async function organizationIdFor(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
  if (!profile) throw new Error("No organization found for this user.");
  return profile.organizationId;
}

function money(value: unknown) {
  return Number(value ?? 0);
}

function mapPayslip(row: {
  id: string;
  payrunId: string;
  workedDays: unknown;
  wage: unknown;
  gross: unknown;
  net: unknown;
  warning: string | null;
  status: PayslipStatus;
  sentAt?: Date | null;
  employee: {
    fullName: string;
    employeeId: string;
    department: { name: string };
    user: { email: string };
  };
  payrun: {
    name: string;
    periodStart: Date;
    periodEnd: Date;
    structure: { name: string };
  };
  lines?: { name: string; code: string; category: SalaryCategory; amount: unknown }[];
}): PayslipListItem {
  const lines = row.lines ?? [];
  return {
    id: row.id,
    payrunId: row.payrunId,
    payrunName: row.payrun.name,
    employeeName: row.employee.fullName,
    employeeCode: row.employee.employeeId,
    department: row.employee.department.name,
    email: row.employee.user.email,
    periodStart: toDateKey(row.payrun.periodStart),
    periodEnd: toDateKey(row.payrun.periodEnd),
    structureName: row.payrun.structure.name,
    status: row.status,
    workedDays: money(row.workedDays),
    wage: money(row.wage),
    gross: money(row.gross),
    net: money(row.net),
    warning: row.warning,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    basic: lines.filter((line) => line.category === "basic").reduce((sum, line) => sum + money(line.amount), 0),
    allowances: lines.filter((line) => line.category === "allowance").reduce((sum, line) => sum + money(line.amount), 0),
    deductions: lines.filter((line) => line.category === "deduction" || line.category === "contribution").reduce((sum, line) => sum + money(line.amount), 0),
  };
}

export async function listEligibleEmployees(input: {
  employeeType?: EmployeeType | null;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  ActionResult<{
    rows: EligibleEmployee[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>
> {
  try {
    await requirePermission("editPayroll");
    const page = clampPage(input.page);
    const pageSize = clampPageSize(input.pageSize, 40, 60);
    const search = input.search?.trim() ?? "";
    const where = {
      status: "active" as const,
      ...(input.employeeType ? { employeeType: input.employeeType } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { employeeId: { contains: search, mode: "insensitive" as const } },
              { user: { email: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [total, profiles] = await Promise.all([
      prisma.employeeProfile.count({ where }),
      prisma.employeeProfile.findMany({
        where,
        include: {
          department: { select: { name: true } },
          user: {
            select: {
              email: true,
              payrolls: { orderBy: { month: "desc" }, take: 1, select: { basic: true } },
            },
          },
        },
        orderBy: { employeeId: "asc" },
        skip: pageSkip(page, pageSize),
        take: pageSize,
      }),
    ]);
    return {
      ok: true,
      data: {
        rows: profiles.map((profile) => {
          const wage = stubWage(profile.wage, profile.user.payrolls[0]?.basic);
          return {
            id: profile.id,
            userId: profile.userId,
            name: profile.fullName,
            email: profile.user.email,
            employeeId: profile.employeeId,
            department: profile.department.name,
            employeeType: profile.employeeType,
            wage,
            bankAccount: profile.bankAccount,
            hasContract: stubHasContract(wage),
          };
        }),
        page,
        pageSize,
        total,
        totalPages: totalPagesFor(total, pageSize),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load employees.") };
  }
}

export async function listPayruns(): Promise<ActionResult<PayrunListItem[]>> {
  try {
    await requirePermission("viewPayrollAll");
    const rows = await prisma.payrun.findMany({
      select: {
        id: true,
        name: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        structure: { select: { name: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: { periodStart: "desc" },
      take: 100,
    });
    const warningGroups =
      rows.length === 0
        ? []
        : await prisma.payslip.groupBy({
            by: ["payrunId"],
            where: {
              payrunId: { in: rows.map((row) => row.id) },
              warning: { not: null },
            },
            _count: { _all: true },
          });
    const warningByPayrun = new Map(warningGroups.map((row) => [row.payrunId, row._count._all]));
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        structureName: row.structure.name,
        periodStart: toDateKey(row.periodStart),
        periodEnd: toDateKey(row.periodEnd),
        status: row.status,
        employeeCount: row._count.payslips,
        warningCount: warningByPayrun.get(row.id) ?? 0,
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payruns.") };
  }
}

export async function getPayrun(id: string): Promise<ActionResult<PayrunDetail>> {
  try {
    await requirePermission("viewPayrollAll");
    const row = await prisma.payrun.findUnique({
      where: { id },
      include: {
        structure: { select: { name: true } },
        payslips: {
          include: {
            lines: true,
            employee: {
              include: {
                user: { select: { email: true } },
                department: { select: { name: true } },
              },
            },
            payrun: { include: { structure: { select: { name: true } } } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!row) return { ok: false, error: "Payrun not found." };
    return {
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        structureId: row.structureId,
        structureName: row.structure.name,
        periodStart: toDateKey(row.periodStart),
        periodEnd: toDateKey(row.periodEnd),
        status: row.status,
        employeeType: row.employeeType,
        employeeCount: row.payslips.length,
        warningCount: row.payslips.filter((slip) => Boolean(slip.warning)).length,
        payslips: row.payslips.map((slip) => mapPayslip(slip)),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payrun.") };
  }
}

export async function createPayrunAction(input: {
  name: string;
  structureId: string;
  periodStart: string;
  periodEnd: string;
  employeeType?: EmployeeType | null;
  employeeIds: string[];
}): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requirePermission("editPayroll");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    if (parsed.data.periodEnd < parsed.data.periodStart) {
      return { ok: false, error: "Period end cannot be before start." };
    }

    const organizationId = await organizationIdFor(actor.id);
    const structureId = parsed.data.structureId || (await ensureRegularSalaryStructure(organizationId));

    const created = await prisma.payrun.create({
      data: {
        organizationId,
        name: parsed.data.name,
        structureId,
        periodStart: dateFromKey(parsed.data.periodStart),
        periodEnd: dateFromKey(parsed.data.periodEnd),
        employeeType: parsed.data.employeeType ?? null,
        status: "draft",
        payslips: {
          create: parsed.data.employeeIds.map((employeeId) => ({
            employeeId,
            workedDays: 0,
            status: "draft",
          })),
        },
      },
    });

    logger.info("payrun.created", { payrunId: created.id, count: parsed.data.employeeIds.length });
    revalidatePayroll(created.id);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not create payrun.") };
  }
}

export async function computePayrunAction(
  payrunId: string,
): Promise<ActionResult<{ jobId: string; status: string }>> {
  try {
    const actor = await requirePermission("editPayroll");
    const payrun = await prisma.payrun.findUnique({
      where: { id: payrunId },
      select: { id: true, organizationId: true, status: true },
    });
    if (!payrun) return { ok: false, error: "Payrun not found." };
    if (payrun.status === "paid") return { ok: false, error: "Paid payruns cannot be recomputed." };

    const { enqueueAndRun } = await import("@/lib/jobs/queue");
    const job = await enqueueAndRun({
      organizationId: payrun.organizationId,
      type: "payrun_compute",
      payload: { payrunId },
      createdByUserId: actor.id,
    });

    if (job.status === "failed") {
      return { ok: false, error: job.error || "Payrun compute job failed." };
    }

    return {
      ok: true,
      data: { jobId: job.id, status: job.status },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not compute payrun.") };
  }
}

export async function validatePayrunAction(payrunId: string): Promise<ActionResult> {
  try {
    await requirePermission("finalizePayroll");
    const payrun = await prisma.payrun.findUnique({
      where: { id: payrunId },
      include: { payslips: { select: { warning: true, status: true } } },
    });
    if (!payrun) return { ok: false, error: "Payrun not found." };
    if (payrun.status === "draft") return { ok: false, error: "Compute the payrun before validating." };
    if (payrun.status === "paid") return { ok: false, error: "Paid payruns cannot be changed." };
    const blocked = payrun.payslips.find((slip) => slip.warning === "No contract for this period");
    if (blocked) return { ok: false, error: "Resolve missing contracts before validating." };
    const uncomputed = payrun.payslips.find((slip) => slip.status === "draft");
    if (uncomputed) return { ok: false, error: "Every payslip must be computed first." };

    await prisma.$transaction([
      prisma.payslip.updateMany({ where: { payrunId }, data: { status: "validated" } }),
      prisma.payrun.update({ where: { id: payrunId }, data: { status: "validated" } }),
    ]);
    revalidatePayroll(payrunId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not validate payrun.") };
  }
}

export async function markPayrunPaidAction(payrunId: string): Promise<ActionResult> {
  try {
    await requirePermission("finalizePayroll");
    const payrun = await prisma.payrun.findUnique({ where: { id: payrunId } });
    if (!payrun) return { ok: false, error: "Payrun not found." };
    if (payrun.status !== "validated") return { ok: false, error: "Validate the payrun before marking it paid." };

    await prisma.$transaction([
      prisma.payslip.updateMany({ where: { payrunId }, data: { status: "paid" } }),
      prisma.payrun.update({ where: { id: payrunId }, data: { status: "paid" } }),
    ]);
    revalidatePayroll(payrunId);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not mark payrun paid.") };
  }
}

export async function listPayslips(input?: {
  page?: number;
  pageSize?: number;
}): Promise<
  ActionResult<{
    rows: PayslipListItem[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }>
> {
  try {
    await requirePermission("viewPayrollAll");
    const page = clampPage(input?.page);
    const pageSize = clampPageSize(input?.pageSize);
    const [total, rows] = await Promise.all([
      prisma.payslip.count(),
      prisma.payslip.findMany({
        select: {
          id: true,
          payrunId: true,
          workedDays: true,
          wage: true,
          gross: true,
          net: true,
          warning: true,
          status: true,
          sentAt: true,
          employee: {
            select: {
              fullName: true,
              employeeId: true,
              department: { select: { name: true } },
              user: { select: { email: true } },
            },
          },
          payrun: {
            select: {
              name: true,
              periodStart: true,
              periodEnd: true,
              structure: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: pageSkip(page, pageSize),
        take: pageSize,
      }),
    ]);
    return {
      ok: true,
      data: {
        rows: rows.map((row) => mapPayslip(row)),
        page,
        pageSize,
        total,
        totalPages: totalPagesFor(total, pageSize),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payslips.") };
  }
}

export async function getPayslip(id: string): Promise<ActionResult<PayslipDetail>> {
  try {
    const user = await requireUser();
    const row = await prisma.payslip.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { code: "asc" } },
        employee: {
          include: {
            user: { select: { email: true, id: true } },
            department: { select: { name: true } },
          },
        },
        payrun: { include: { structure: { select: { name: true } } } },
      },
    });
    if (!row) return { ok: false, error: "Payslip not found." };
    const isOwner = row.employee.userId === user.id;
    if (!isOwner) {
      await requirePermission("viewPayrollAll");
    }
    const mapped = mapPayslip(row);
    return {
      ok: true,
      data: {
        ...mapped,
        lines: row.lines.map((line) => ({
          name: line.name,
          code: line.code,
          category: line.category,
          amount: money(line.amount),
        })),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payslip.") };
  }
}

export async function listMyPayslips(): Promise<ActionResult<PayslipListItem[]>> {
  try {
    const user = await requireUser();
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return { ok: true, data: [] };
    const rows = await prisma.payslip.findMany({
      where: { employeeId: profile.id, status: { in: ["validated", "paid"] } },
      select: {
        id: true,
        payrunId: true,
        workedDays: true,
        wage: true,
        gross: true,
        net: true,
        warning: true,
        status: true,
        sentAt: true,
        employee: {
          select: {
            fullName: true,
            employeeId: true,
            department: { select: { name: true } },
            user: { select: { email: true } },
          },
        },
        payrun: {
          select: {
            name: true,
            periodStart: true,
            periodEnd: true,
            structure: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 48,
    });
    return { ok: true, data: rows.map((row) => mapPayslip(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load your payslips.") };
  }
}

export async function sendPayslipsAction(
  payrunId: string,
): Promise<ActionResult<{ sent: number; failed: number; skipped: number }>> {
  try {
    await requirePermission("editPayroll");
    const payrun = await prisma.payrun.findUnique({
      where: { id: payrunId },
      include: {
        structure: { select: { name: true } },
        payslips: { include: payslipEmailInclude },
      },
    });
    if (!payrun) return { ok: false, error: "Payrun not found." };
    if (payrun.status !== "validated" && payrun.status !== "paid") {
      return { ok: false, error: "Validate the payrun before sending payslips." };
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const slip of payrun.payslips) {
      const result = await deliverUnsentPayslip(slip);
      if (result === "sent") sent += 1;
      else if (result === "failed") failed += 1;
      else skipped += 1;
    }
    revalidatePayroll(payrunId);
    return { ok: true, data: { sent, failed, skipped } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not send payslips.") };
  }
}

export async function sendPayslipEmailAction(
  payslipId: string,
): Promise<ActionResult<{ sent: boolean }>> {
  try {
    await requirePermission("editPayroll");
    const slip = await prisma.payslip.findUnique({
      where: { id: payslipId },
      include: payslipEmailInclude,
    });
    if (!slip) return { ok: false, error: "Payslip not found." };
    if (slip.status !== "validated" && slip.status !== "paid") {
      return { ok: false, error: "Validate the payslip before emailing it." };
    }
    if (slip.payrun.status !== "validated" && slip.payrun.status !== "paid") {
      return { ok: false, error: "Validate the payrun before emailing payslips." };
    }

    try {
      await emailPayslipNow(slip);
    } catch (error) {
      return { ok: false, error: actionErrorMessage(error, "Could not email this payslip.") };
    }

    revalidatePayroll(slip.payrunId);
    revalidatePath(`/admin/hr/payroll/payslips/${slip.id}`);
    return { ok: true, data: { sent: true } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not email this payslip.") };
  }
}

export async function issueMonthEndPayslipsAction(
  month?: string,
): Promise<ActionResult<{ month: string; sent: number; failed: number; skipped: number }>> {
  try {
    await requirePermission("editPayroll");
    const result = await issueMonthEndPayslips(month || payslipIssueMonth());
    revalidatePayroll();
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not email month-end payslips.") };
  }
}
