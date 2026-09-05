"use server";

import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  dateFromKey,
  inclusiveDayCount,
  isLateCheckIn,
  kolkataTodayKey,
  toDateKey,
} from "@/lib/shared/dates";
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
  leaveToday: number;
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
    const today = kolkataTodayKey();
    const todayDate = dateFromKey(today);

    const profileFilter = {
      ...(input.department ? { department: { name: input.department } } : {}),
      ...(input.employeeType ? { employeeType: input.employeeType } : {}),
    };
    const profileSelect = {
      department: { select: { name: true } },
      employeeType: true,
    } as const;

    const [
      departments,
      approvedLeaves,
      attendancePeriod,
      attendanceToday,
      wageProfiles,
      payslips,
      drafts,
      missingWage,
    ] = await Promise.all([
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
      prisma.attendance.findMany({
        where: { date: todayDate },
        include: { user: { select: { profile: { select: profileSelect } } } },
      }),
      canViewPayroll
        ? prisma.employeeProfile.findMany({
            where: {
              status: { not: "inactive" },
              ...profileFilter,
            },
            select: {
              wage: true,
              department: { select: { name: true } },
              contracts: {
                where: { status: "running" },
                orderBy: { startDate: "desc" },
                take: 1,
                select: { wage: true },
              },
            },
          })
        : Promise.resolve([]),
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
      canViewPayroll ? prisma.payrun.count({ where: { status: "draft" } }) : Promise.resolve(0),
      canViewPayroll
        ? prisma.employeeProfile.count({
            where: {
              status: { not: "inactive" },
              wage: null,
              contracts: { none: { status: "running" } },
            },
          })
        : Promise.resolve(0),
    ]);

    const leaves = approvedLeaves.filter((row) => {
      if (input.department && row.user.profile?.department.name !== input.department) return false;
      if (input.employeeType && row.user.profile?.employeeType !== input.employeeType) return false;
      return true;
    });
    const attPeriod = attendancePeriod.filter((row) => {
      if (input.department && row.user.profile?.department.name !== input.department) return false;
      if (input.employeeType && row.user.profile?.employeeType !== input.employeeType) return false;
      return true;
    });
    const attToday = attendanceToday.filter((row) => {
      if (input.department && row.user.profile?.department.name !== input.department) return false;
      if (input.employeeType && row.user.profile?.employeeType !== input.employeeType) return false;
      return true;
    });

    const approvedTimeOffDays = leaves.reduce(
      (sum, row) => sum + inclusiveDayCount(toDateKey(row.startDate), toDateKey(row.endDate)),
      0,
    );

    const present = attToday.filter((row) => row.status === "present" || row.status === "half_day").length;
    const late = attToday.filter((row) => isLateCheckIn(row.checkIn)).length;
    const absent = attToday.filter((row) => row.status === "absent").length;
    const leaveToday = attToday.filter((row) => row.status === "leave").length;
    const missingCheckout = attToday.filter((row) => row.checkIn && !row.checkOut).length;

    const periodPresent = attPeriod.filter(
      (row) => row.status === "present" || row.status === "half_day",
    ).length;
    const periodAbsent = attPeriod.filter((row) => row.status === "absent").length;
    const coverageBase = periodPresent + periodAbsent;
    const attendanceHealth =
      coverageBase === 0 ? 0 : Math.round((periodPresent / coverageBase) * 100);

    const paid = payslips.filter((row) => row.status === "paid");
    const totalNetPaid = paid.reduce((sum, row) => sum + Number(row.net), 0);

    // Prefer live wage/contract rollup so the chart reflects org cost even without payslips.
    const salaryByDepartmentMap = new Map<string, number>();
    for (const profile of wageProfiles) {
      const wage = Number(profile.contracts[0]?.wage ?? profile.wage ?? 0);
      if (wage <= 0) continue;
      const name = profile.department.name;
      salaryByDepartmentMap.set(name, (salaryByDepartmentMap.get(name) ?? 0) + wage);
    }
    if (salaryByDepartmentMap.size === 0) {
      for (const row of paid) {
        salaryByDepartmentMap.set(
          row.employee.department.name,
          (salaryByDepartmentMap.get(row.employee.department.name) ?? 0) + Number(row.net),
        );
      }
    }

    const monthMap = new Map<string, number>();
    for (const row of paid) {
      const key = toDateKey(row.createdAt).slice(0, 7);
      monthMap.set(key, (monthMap.get(key) ?? 0) + Number(row.net));
    }

    const missingBank = canViewPayroll
      ? await prisma.employeeProfile.count({
          where: {
            status: { not: "inactive" },
            OR: [{ bankAccount: null }, { bankAccount: "" }],
          },
        })
      : 0;
    const duplicateWarnings = payslips.filter((row) => row.warning === "Duplicate").length;
    const alerts: string[] = [];
    if (canViewPayroll) {
      if (missingBank) alerts.push(`${missingBank} employees missing bank account`);
      if (duplicateWarnings) alerts.push(`${duplicateWarnings} duplicate payslip warning`);
      if (drafts) alerts.push(`${drafts} drafts still not validated`);
      if (missingWage) alerts.push(`${missingWage} employees missing a period wage/contract`);
      if (absent) alerts.push(`${absent} marked absent today`);
      if (leaveToday) alerts.push(`${leaveToday} on leave in today's attendance`);
    }

    const salaryByDepartment = [...salaryByDepartmentMap.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);

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
        salaryByDepartment,
        monthlyTrend: [...monthMap.entries()].map(([month, net]) => ({ month, net })),
        alerts,
        present,
        late,
        absent,
        leaveToday,
        missingCheckout,
        departments: departments.map((row) => row.name).filter(Boolean),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payroll dashboard.") };
  }
}
