"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { dateFromKey, payslipIssueMonth, toDateKey } from "@/lib/shared/dates";
import { computePayslip } from "@/lib/payroll/compute";
import { payslipWarning } from "@/lib/payroll/warnings";
import { stubHasContract, stubWage } from "@/lib/payroll/period-wage";
import { stubWorkedDays, unpaidDaysInPeriod, weekdayCount } from "@/lib/payroll/worked-days";
import { ensureRegularSalaryStructure } from "@/lib/actions/payroll/salary";
import {
  deliverUnsentPayslip,
  emailPayslipNow,
  issueMonthEndPayslips,
  payslipEmailInclude,
} from "@/lib/payroll/deliver-payslips";
import type { ActionResult } from "@/lib/shared/types";
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
}): Promise<ActionResult<EligibleEmployee[]>> {
  try {
    await requirePermission("editPayroll");
    const profiles = await prisma.employeeProfile.findMany({
      where: {
        status: "active",
        ...(input.employeeType ? { employeeType: input.employeeType } : {}),
      },
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
    });
    return {
      ok: true,
      data: profiles.map((profile) => {
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
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load employees.") };
  }
}

export async function listPayruns(): Promise<ActionResult<PayrunListItem[]>> {
  try {
    await requirePermission("viewPayrollAll");
    const rows = await prisma.payrun.findMany({
      include: {
        structure: { select: { name: true } },
        payslips: { select: { warning: true } },
      },
      orderBy: { periodStart: "desc" },
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        structureName: row.structure.name,
        periodStart: toDateKey(row.periodStart),
        periodEnd: toDateKey(row.periodEnd),
        status: row.status,
        employeeCount: row.payslips.length,
        warningCount: row.payslips.filter((slip) => Boolean(slip.warning)).length,
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

export async function computePayrunAction(payrunId: string): Promise<ActionResult> {
  try {
    await requirePermission("editPayroll");
    const payrun = await prisma.payrun.findUnique({
      where: { id: payrunId },
      include: {
        structure: { include: { rules: { orderBy: { sequence: "asc" } } } },
        payslips: {
          include: {
            employee: {
              include: {
                user: {
                  select: {
                    id: true,
                    payrolls: { orderBy: { month: "desc" }, take: 1, select: { basic: true } },
                    leaveRequests: {
                      select: {
                        type: { select: { code: true } },
                        status: true,
                        startDate: true,
                        endDate: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!payrun) return { ok: false, error: "Payrun not found." };
    if (payrun.status === "paid") return { ok: false, error: "Paid payruns cannot be recomputed." };

    const periodStart = toDateKey(payrun.periodStart);
    const periodEnd = toDateKey(payrun.periodEnd);
    const scheduledDays = weekdayCount(periodStart, periodEnd);

    for (const slip of payrun.payslips) {
      const wage = stubWage(slip.employee.wage, slip.employee.user.payrolls[0]?.basic);
      const unpaidLeaveDays = unpaidDaysInPeriod(
        periodStart,
        periodEnd,
        slip.employee.user.leaveRequests.map((leave) => ({
          type: leave.type.code,
          status: leave.status,
          startDate: toDateKey(leave.startDate),
          endDate: toDateKey(leave.endDate),
        })),
      );
      const workedDays = stubWorkedDays(scheduledDays, unpaidLeaveDays);
      const duplicate = await prisma.payslip.findFirst({
        where: {
          id: { not: slip.id },
          employeeId: slip.employeeId,
          payrun: {
            id: { not: payrun.id },
            periodStart: payrun.periodStart,
            periodEnd: payrun.periodEnd,
          },
        },
        select: { id: true },
      });

      const warning = payslipWarning({
        bankAccount: slip.employee.bankAccount,
        hasContract: stubHasContract(wage),
        duplicateInOtherPayrun: Boolean(duplicate),
      });

      let gross = 0;
      let net = 0;
      let lines: { name: string; code: string; category: SalaryCategory; amount: number; ruleId: string }[] = [];
      if (stubHasContract(wage) && payrun.structure.rules.length > 0) {
        const computed = computePayslip(
          payrun.structure.rules.map((rule) => ({
            name: rule.name,
            code: rule.code,
            category: rule.category,
            sequence: rule.sequence,
            computation: rule.computation,
            amount: rule.amount == null ? undefined : Number(rule.amount),
            percentage: rule.percentage == null ? undefined : Number(rule.percentage),
            percentBaseCode: rule.percentBaseCode ?? undefined,
            formula: rule.formula ?? undefined,
          })),
          { wage, workedDays, scheduledDays, unpaidLeaveDays },
        );
        gross = computed.gross;
        net = computed.net;
        lines = computed.lines.map((line) => ({
          ...line,
          ruleId: payrun.structure.rules.find((rule) => rule.code === line.code)?.id ?? "",
        }));
      }

      await prisma.$transaction([
        prisma.payslipLine.deleteMany({ where: { payslipId: slip.id } }),
        prisma.payslip.update({
          where: { id: slip.id },
          data: {
            workedDays,
            wage,
            gross,
            net,
            warning,
            status: "computed",
            lines: {
              create: lines.map((line) => ({
                ruleId: line.ruleId || null,
                name: line.name,
                code: line.code,
                category: line.category,
                amount: line.amount,
              })),
            },
          },
        }),
      ]);
    }

    await prisma.payrun.update({ where: { id: payrunId }, data: { status: "computed" } });
    revalidatePayroll(payrunId);
    return { ok: true, data: undefined };
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

export async function listPayslips(): Promise<ActionResult<PayslipListItem[]>> {
  try {
    await requirePermission("viewPayrollAll");
    const rows = await prisma.payslip.findMany({
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
      orderBy: { createdAt: "desc" },
    });
    return { ok: true, data: rows.map((row) => mapPayslip(row)) };
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
      orderBy: { createdAt: "desc" },
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
