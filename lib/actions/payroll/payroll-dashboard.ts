"use server";

import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { dateFromKey, inclusiveDayCount, isLateCheckIn, toDateKey } from "@/lib/shared/dates";
import type { ActionResult } from "@/lib/shared/types";
import type { SessionUser } from "@/lib/shared/types";

export type PayrollDashboardData = {
  canViewPayroll: boolean;
  totalNetPaid: number;
  payslipsGenerated: number;
  payslipsPaid: number;
  payslipsPending: number;
  avgSalary: number;
  approvedTimeOffDays: number;
  attendanceHealth: number;
  salaryByDepartment: { name: string; value: number }[];
  monthlyTrend: { month: string; net: number }[];
  alerts: string[];
  present: number;
  late: number;
  absent: number;
  missingCheckout: number;
  departments: string[];
};

export async function getPayrollDashboard(input: {
  user: SessionUser;
  periodStart: string;
  periodEnd: string;
  department?: string;
  employeeType?: "full_time" | "intern" | "contractor" | "";
}): Promise<ActionResult<PayrollDashboardData>> {
  try {
    await requirePermission("viewAdminDashboard");
    const canViewPayroll = hasPermission(input.user.role, "viewPayrollAll");
    const start = dateFromKey(input.periodStart);
    const end = dateFromKey(input.periodEnd);

    const profileFilter = {
      ...(input.department ? { department: { name: input.department } } : {}),
      ...(input.employeeType ? { employeeType: input.employeeType } : {}),
    };
    const profileSelect = {
      department: { select: { name: true } },
      employeeType: true,
    } as const;

    const [departments, approvedLeaves, attendance, payslips, drafts, expiring] = await Promise.all([
      prisma.department.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
      prisma.leaveRequest.findMany({
        where: {
          status: "approved",
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: { user: { select: { profile: { select: profileSelect } } } },
      }),
      prisma.attendance.findMany({
        where: { date: { gte: start, lte: end } },
        include: { user: { select: { profile: { select: profileSelect } } } },
      }),
      canViewPayroll
        ? prisma.payslip.findMany({
            where: {
              payrun: { periodStart: { gte: start }, periodEnd: { lte: end } },
              ...(input.department || input.employeeType
                ? { employee: profileFilter }
                : {}),
            },
            include: {
              employee: {
                select: {
                  department: { select: { name: true } },
                  bankAccount: true,
                  wage: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      canViewPayroll
        ? prisma.payrun.count({ where: { status: "draft" } })
        : Promise.resolve(0),
      canViewPayroll
        ? prisma.employeeProfile.count({
            where: { wage: null },
          })
        : Promise.resolve(0),
    ]);

    const leaves = approvedLeaves.filter((row) => {
      if (input.department && row.user.profile?.department.name !== input.department) return false;
      if (input.employeeType && row.user.profile?.employeeType !== input.employeeType) return false;
      return true;
    });
    const att = attendance.filter((row) => {
      if (input.department && row.user.profile?.department.name !== input.department) return false;
      if (input.employeeType && row.user.profile?.employeeType !== input.employeeType) return false;
      return true;
    });

    const approvedTimeOffDays = leaves.reduce(
      (sum, row) => sum + inclusiveDayCount(toDateKey(row.startDate), toDateKey(row.endDate)),
      0,
    );
    const present = att.filter((row) => row.status === "present" || row.status === "half_day").length;
    const late = att.filter((row) => isLateCheckIn(row.checkIn)).length;
    const absent = att.filter((row) => row.status === "absent").length;
    const missingCheckout = att.filter((row) => row.checkIn && !row.checkOut).length;
    const coverageBase = present + absent + missingCheckout;
    const attendanceHealth = coverageBase === 0 ? 0 : Math.round((present / coverageBase) * 100);

    const paid = payslips.filter((row) => row.status === "paid");
    const totalNetPaid = paid.reduce((sum, row) => sum + Number(row.net), 0);
    const salaryByDepartmentMap = new Map<string, number>();
    for (const row of paid) {
      salaryByDepartmentMap.set(
        row.employee.department.name,
        (salaryByDepartmentMap.get(row.employee.department.name) ?? 0) + Number(row.net),
      );
    }

    const monthMap = new Map<string, number>();
    for (const row of paid) {
      const key = toDateKey(row.createdAt).slice(0, 7);
      monthMap.set(key, (monthMap.get(key) ?? 0) + Number(row.net));
    }

    const missingBank = payslips.filter((row) => !row.employee.bankAccount).length;
    const duplicateWarnings = payslips.filter((row) => row.warning === "Duplicate").length;
    const alerts: string[] = [];
    if (canViewPayroll) {
      if (missingBank) alerts.push(`${missingBank} employees missing bank account`);
      if (duplicateWarnings) alerts.push(`${duplicateWarnings} duplicate payslip warning`);
      if (drafts) alerts.push(`${drafts} drafts still not validated`);
      if (expiring) alerts.push(`${expiring} employees missing a period wage/contract`);
    }

    return {
      ok: true,
      data: {
        canViewPayroll,
        totalNetPaid,
        payslipsGenerated: payslips.length,
        payslipsPaid: paid.length,
        payslipsPending: payslips.length - paid.length,
        avgSalary: paid.length ? totalNetPaid / paid.length : 0,
        approvedTimeOffDays,
        attendanceHealth,
        salaryByDepartment: [...salaryByDepartmentMap.entries()].map(([name, value]) => ({ name, value })),
        monthlyTrend: [...monthMap.entries()].map(([month, net]) => ({ month, net })),
        alerts,
        present,
        late,
        absent,
        missingCheckout,
        departments: departments.map((row) => row.name).filter(Boolean),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payroll dashboard.") };
  }
}
