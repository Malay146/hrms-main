"use server";

import { unstable_cache } from "next/cache";
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
import type { EmployeeType, Prisma } from "@/generated/prisma/client";

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

function profileFilterFrom(
  organizationId: string,
  department: string,
  employeeType: string,
): Prisma.EmployeeProfileWhereInput {
  return {
    organizationId,
    ...(department ? { department: { name: department } } : {}),
    ...(employeeType
      ? { employeeType: employeeType as EmployeeType }
      : {}),
  };
}

async function loadPayrollDashboardSnapshot(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
  department: string,
  employeeType: string,
  canViewPayroll: boolean,
  today: string,
): Promise<PayrollDashboardData> {
  const start = dateFromKey(periodStart);
  const end = dateFromKey(periodEnd);
  const todayDate = dateFromKey(today);
  const profileFilter = profileFilterFrom(organizationId, department, employeeType);
  const attendanceWhere: Prisma.AttendanceWhereInput = {
    user: { profile: profileFilter },
  };
  const leaveWhere: Prisma.LeaveRequestWhereInput = {
    status: "approved",
    startDate: { lte: end },
    endDate: { gte: start },
    user: { profile: profileFilter },
  };
  const payslipWhere: Prisma.PayslipWhereInput = {
    payrun: {
      organizationId,
      periodStart: { gte: start },
      periodEnd: { lte: end },
    },
    ...(department || employeeType ? { employee: profileFilter } : {}),
  };

  const [
    departments,
    approvedLeaveDates,
    todayStatusGroups,
    todayCheckIns,
    missingCheckout,
    periodStatusGroups,
    wageProfiles,
    payslipStatusGroups,
    paidTrend,
    paidAgg,
    drafts,
    missingWage,
    duplicateWarnings,
    missingBank,
  ] = await Promise.all([
    prisma.department.findMany({
      where: { organizationId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: leaveWhere,
      select: { startDate: true, endDate: true },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { ...attendanceWhere, date: todayDate },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: {
        ...attendanceWhere,
        date: todayDate,
        status: { in: ["present", "half_day"] },
        checkIn: { not: null },
      },
      select: { checkIn: true },
    }),
    prisma.attendance.count({
      where: {
        ...attendanceWhere,
        date: todayDate,
        checkIn: { not: null },
        checkOut: null,
      },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: {
        ...attendanceWhere,
        date: { gte: start, lte: end },
      },
      _count: { _all: true },
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
      ? prisma.payslip.groupBy({
          by: ["status"],
          where: payslipWhere,
          _count: { _all: true },
        })
      : Promise.resolve([] as { status: string; _count: { _all: number } }[]),
    canViewPayroll
      ? prisma.payslip.findMany({
          where: { ...payslipWhere, status: "paid" },
          select: { net: true, createdAt: true },
        })
      : Promise.resolve([]),
    canViewPayroll
      ? prisma.payslip.aggregate({
          where: { ...payslipWhere, status: "paid" },
          _sum: { net: true },
          _count: true,
        })
      : Promise.resolve({ _sum: { net: null }, _count: 0 }),
    canViewPayroll
      ? prisma.payrun.count({ where: { organizationId, status: "draft" } })
      : Promise.resolve(0),
    canViewPayroll
      ? prisma.employeeProfile.count({
          where: {
            organizationId,
            status: { not: "inactive" },
            wage: null,
            contracts: { none: { status: "running" } },
          },
        })
      : Promise.resolve(0),
    canViewPayroll
      ? prisma.payslip.count({
          where: { ...payslipWhere, warning: "Duplicate" },
        })
      : Promise.resolve(0),
    canViewPayroll
      ? prisma.employeeProfile.count({
          where: {
            organizationId,
            status: { not: "inactive" },
            OR: [{ bankAccount: null }, { bankAccount: "" }],
          },
        })
      : Promise.resolve(0),
  ]);

  const approvedTimeOffDays = approvedLeaveDates.reduce(
    (sum, row) => sum + inclusiveDayCount(toDateKey(row.startDate), toDateKey(row.endDate)),
    0,
  );

  const todayByStatus = new Map(
    todayStatusGroups.map((row) => [row.status, row._count._all]),
  );
  const present =
    (todayByStatus.get("present") ?? 0) + (todayByStatus.get("half_day") ?? 0);
  const late = todayCheckIns.filter((row) => isLateCheckIn(row.checkIn)).length;
  const absent = todayByStatus.get("absent") ?? 0;
  const leaveToday = todayByStatus.get("leave") ?? 0;

  const periodByStatus = new Map(
    periodStatusGroups.map((row) => [row.status, row._count._all]),
  );
  const periodPresent =
    (periodByStatus.get("present") ?? 0) + (periodByStatus.get("half_day") ?? 0);
  const periodAbsent = periodByStatus.get("absent") ?? 0;
  const coverageBase = periodPresent + periodAbsent;
  const attendanceHealth =
    coverageBase === 0 ? 0 : Math.round((periodPresent / coverageBase) * 100);

  const payslipsByStatus = new Map(
    payslipStatusGroups.map((row) => [row.status, row._count._all]),
  );
  const payslipsGenerated = [...payslipsByStatus.values()].reduce((a, b) => a + b, 0);
  const payslipsPaid = payslipsByStatus.get("paid") ?? 0;
  const payslipsPending = payslipsGenerated - payslipsPaid;
  const totalNetPaid = Number(paidAgg._sum.net ?? 0);
  const avgSalary = payslipsPaid ? totalNetPaid / payslipsPaid : 0;

  const salaryByDepartmentMap = new Map<string, number>();
  for (const profile of wageProfiles) {
    const wage = Number(profile.contracts[0]?.wage ?? profile.wage ?? 0);
    if (wage <= 0) continue;
    const name = profile.department.name;
    salaryByDepartmentMap.set(name, (salaryByDepartmentMap.get(name) ?? 0) + wage);
  }
  if (salaryByDepartmentMap.size === 0 && canViewPayroll && payslipsPaid > 0) {
    const paidWithDept = await prisma.payslip.findMany({
      where: { ...payslipWhere, status: "paid" },
      select: {
        net: true,
        employee: { select: { department: { select: { name: true } } } },
      },
    });
    for (const row of paidWithDept) {
      salaryByDepartmentMap.set(
        row.employee.department.name,
        (salaryByDepartmentMap.get(row.employee.department.name) ?? 0) + Number(row.net),
      );
    }
  }

  const monthMap = new Map<string, number>();
  for (const row of paidTrend) {
    const key = toDateKey(row.createdAt).slice(0, 7);
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(row.net));
  }

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
    canViewPayroll,
    totalNetPaid,
    payslipsGenerated,
    payslipsPaid,
    payslipsPending,
    avgSalary,
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
  };
}

const getCachedPayrollDashboard = unstable_cache(
  async (
    organizationId: string,
    periodStart: string,
    periodEnd: string,
    department: string,
    employeeType: string,
    canViewPayroll: boolean,
    today: string,
  ) =>
    loadPayrollDashboardSnapshot(
      organizationId,
      periodStart,
      periodEnd,
      department,
      employeeType,
      canViewPayroll,
      today,
    ),
  ["payroll-dashboard"],
  { revalidate: 30, tags: ["payroll"] },
);

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
    const today = kolkataTodayKey();

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: input.user.id },
      select: { organizationId: true },
    });
    if (!profile) {
      return { ok: false, error: "No organization found for this user." };
    }

    const data = await getCachedPayrollDashboard(
      profile.organizationId,
      input.periodStart,
      input.periodEnd,
      input.department ?? "",
      input.employeeType ?? "",
      canViewPayroll,
      today,
    );

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load payroll dashboard.") };
  }
}
