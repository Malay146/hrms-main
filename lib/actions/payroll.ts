"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/session";
import { mapPayroll } from "@/lib/mappers";
import { currentPayrollMonth } from "@/lib/dates";
import { firstZodError, upsertPayrollSchema } from "@/lib/validations";
import type { ActionResult, PayrollListItem } from "@/lib/types";

export async function listPayroll(): Promise<ActionResult<PayrollListItem[]>> {
  try {
    await requirePermission("viewPayrollAll");
    const month = currentPayrollMonth();
    const profiles = await prisma.employeeProfile.findMany({
      include: {
        user: {
          include: {
            payrolls: { where: { month } },
          },
        },
      },
      orderBy: { employeeId: "asc" },
    });

    const data: PayrollListItem[] = profiles.map((profile) => {
      const payroll = profile.user.payrolls[0];
      if (payroll) {
        return mapPayroll({
          ...payroll,
          user: {
            email: profile.user.email,
            profile: {
              employeeId: profile.employeeId,
              fullName: profile.fullName,
              department: profile.department,
              jobTitle: profile.jobTitle,
            },
          },
        });
      }
      return {
        id: `draft-${profile.userId}`,
        userId: profile.userId,
        employeeId: profile.employeeId,
        name: profile.fullName,
        email: profile.user.email,
        avatar: profile.fullName
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        role: profile.jobTitle,
        department: profile.department,
        month,
        monthLabel: month,
        basic: 0,
        hraPct: 20,
        allowancePct: 10,
        deductions: 0,
        netSalary: 0,
      };
    });

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payroll.") };
  }
}

export async function getMyPayroll(): Promise<ActionResult<PayrollListItem[]>> {
  try {
    const user = await requireUser();
    const rows = await prisma.payroll.findMany({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: { employeeId: true, fullName: true, department: true, jobTitle: true },
            },
          },
        },
      },
      orderBy: { month: "desc" },
    });
    return { ok: true, data: rows.map((row) => mapPayroll(row)) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payroll.") };
  }
}

export async function upsertPayrollAction(input: {
  userId: string;
  month: string;
  basic: number;
  hraPct: number;
  allowancePct: number;
  deductions: number;
}): Promise<ActionResult<PayrollListItem>> {
  try {
    const admin = await requirePermission("editPayroll");
    const parsed = upsertPayrollSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const saved = await prisma.payroll.upsert({
      where: {
        userId_month: { userId: parsed.data.userId, month: parsed.data.month },
      },
      update: {
        basic: parsed.data.basic,
        hraPct: parsed.data.hraPct,
        allowancePct: parsed.data.allowancePct,
        deductions: parsed.data.deductions,
      },
      create: {
        userId: parsed.data.userId,
        month: parsed.data.month,
        basic: parsed.data.basic,
        hraPct: parsed.data.hraPct,
        allowancePct: parsed.data.allowancePct,
        deductions: parsed.data.deductions,
      },
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: { employeeId: true, fullName: true, department: true, jobTitle: true },
            },
          },
        },
      },
    });

    logger.info("payroll.upserted", { payrollId: saved.id, adminId: admin.id });
    revalidatePath("/admin/hr/payroll");
    revalidatePath("/employee/payroll");
    return { ok: true, data: mapPayroll(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save payroll.") };
  }
}
