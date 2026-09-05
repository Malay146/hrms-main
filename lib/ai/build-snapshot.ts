import { PIE_COLORS } from "@/lib/mappers";
import { inclusiveDayCount } from "@/lib/dates";
import { LEAVE_TYPE_LABELS, type AiAnalyticsData, type AiFlightRiskRow, type AiInsightCard } from "@/lib/types";
import {
  addDaysToKey,
  attendanceRate,
  departmentAttendance,
  flightRiskScore,
  leaveClashCount,
  weekdayCount,
  workforceHealthScore,
} from "./metrics";
import type { InternalSnapshot } from "./snapshot";

export type SnapshotEmployee = {
  id: string;
  userId: string;
  employeeId: string;
  fullName: string;
  department: string;
  status: "active" | "inactive" | "on_leave";
  paidLeaveBalance: number;
  bankAccount: string | null;
  wage: number | null;
  createdAt: Date;
};

export type SnapshotAttendance = {
  userId: string;
  date: string;
  status: "present" | "absent" | "half_day" | "leave";
  checkIn: Date | null;
  checkOut: Date | null;
};

export type SnapshotLeave = {
  userId: string;
  type: "paid" | "sick" | "unpaid";
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
  department: string;
};

export type BuildAiSnapshotInput = {
  employees: SnapshotEmployee[];
  attendance: SnapshotAttendance[];
  leaves: SnapshotLeave[];
  payrollNet: number | null;
  payrunWarningPct: number;
  weeklyAttendance: { day: string; attendance: number }[];
  periodStart: string;
  periodEnd: string;
  today: string;
  canPeople: boolean;
  canPayroll: boolean;
  aiEnabled: boolean;
  insights: AiInsightCard[];
};

function inRange(dateKey: string, start: string, end: string) {
  return dateKey >= start && dateKey <= end;
}

function overlapDays(start: string, end: string, periodStart: string, periodEnd: string) {
  const from = start > periodStart ? start : periodStart;
  const to = end < periodEnd ? end : periodEnd;
  if (from > to) return 0;
  return inclusiveDayCount(from, to);
}

function periodLengthDays(periodStart: string, periodEnd: string) {
  return inclusiveDayCount(periodStart, periodEnd);
}

export function buildAiSnapshot(input: BuildAiSnapshotInput): {
  data: AiAnalyticsData;
  modelInput: InternalSnapshot;
} {
  const expectedDays = weekdayCount(input.periodStart, input.periodEnd);
  const length = periodLengthDays(input.periodStart, input.periodEnd);
  const prevEnd = addDaysToKey(input.periodStart, -1);
  const prevStart = addDaysToKey(input.periodStart, -length);
  const prevExpected = weekdayCount(prevStart, prevEnd);

  const headcount = Math.max(1, input.employees.length);
  const inactivePct =
    (input.employees.filter((row) => row.status === "inactive").length / headcount) * 100;

  const countsByUser = new Map<string, { present: number; half: number; absent: number; prevPresent: number; prevHalf: number }>();
  for (const employee of input.employees) {
    countsByUser.set(employee.userId, { present: 0, half: 0, absent: 0, prevPresent: 0, prevHalf: 0 });
  }
  for (const row of input.attendance) {
    const bucket = countsByUser.get(row.userId);
    if (!bucket) continue;
    if (inRange(row.date, input.periodStart, input.periodEnd)) {
      if (row.status === "present") bucket.present += 1;
      if (row.status === "half_day") bucket.half += 1;
      if (row.status === "absent") bucket.absent += 1;
    }
    if (inRange(row.date, prevStart, prevEnd)) {
      if (row.status === "present") bucket.prevPresent += 1;
      if (row.status === "half_day") bucket.prevHalf += 1;
    }
  }

  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  for (const bucket of countsByUser.values()) {
    presentDays += bucket.present;
    halfDays += bucket.half;
    absentDays += bucket.absent;
  }

  const orgExpected = expectedDays * input.employees.length;
  const attendancePct = attendanceRate({
    expectedDays: orgExpected,
    presentDays,
    halfDays,
    absentDays,
  });

  const pending = input.leaves.filter((row) => row.status === "pending");
  const approved = input.leaves.filter((row) => row.status === "approved");
  const pendingApprovals = pending.length;
  const leaveDaysApproved = approved.reduce(
    (sum, row) => sum + overlapDays(row.startDate, row.endDate, input.periodStart, input.periodEnd),
    0,
  );

  const typeTotals: Record<"paid" | "sick" | "unpaid", number> = { paid: 0, sick: 0, unpaid: 0 };
  for (const row of approved) {
    typeTotals[row.type] += overlapDays(row.startDate, row.endDate, input.periodStart, input.periodEnd);
  }
  const leaveTotal = typeTotals.paid + typeTotals.sick + typeTotals.unpaid;
  const leaveByType = (["paid", "sick", "unpaid"] as const).map((type, index) => ({
    name: LEAVE_TYPE_LABELS[type],
    value: typeTotals[type],
    color: PIE_COLORS[index % PIE_COLORS.length],
    percentage: leaveTotal === 0 ? "0%" : `${Math.round((typeTotals[type] / leaveTotal) * 100)}%`,
  }));

  const clashes = input.leaves
    .filter((row) => row.status !== "rejected")
    .map((row) => ({ department: row.department, start: row.startDate, end: row.endDate }));

  const clashCount = leaveClashCount(clashes);

  const health = workforceHealthScore({
    attendancePct,
    pendingLeavePerEmployee: input.employees.length === 0 ? 0 : pendingApprovals / input.employees.length,
    inactivePct,
    payrunWarningPct: input.canPayroll ? input.payrunWarningPct : 0,
  });

  const today = new Date(`${input.today}T00:00:00.000Z`);
  const flightRisk: AiFlightRiskRow[] = [];
  const modelEmployees: InternalSnapshot["employees"] = [];

  for (const employee of input.employees) {
    const bucket = countsByUser.get(employee.userId)!;
    const current = attendanceRate({
      expectedDays,
      presentDays: bucket.present,
      halfDays: bucket.half,
      absentDays: bucket.absent,
    });
    const previous = attendanceRate({
      expectedDays: prevExpected,
      presentDays: bucket.prevPresent,
      halfDays: bucket.prevHalf,
      absentDays: 0,
    });
    const attendanceDeltaPct = current - previous;
    const sickLeaveDays30 = input.leaves
      .filter((row) => row.userId === employee.userId && row.type === "sick" && row.status !== "rejected")
      .reduce((sum, row) => sum + overlapDays(row.startDate, row.endDate, input.periodStart, input.periodEnd), 0);
    const unpaidLeaveDays30 = input.leaves
      .filter((row) => row.userId === employee.userId && row.type === "unpaid" && row.status !== "rejected")
      .reduce((sum, row) => sum + overlapDays(row.startDate, row.endDate, input.periodStart, input.periodEnd), 0);
    const tenureDays = Math.max(
      0,
      Math.floor((today.getTime() - employee.createdAt.getTime()) / 86_400_000),
    );
    const score = flightRiskScore({
      attendanceDeltaPct,
      sickLeaveDays30,
      unpaidLeaveDays30,
      paidBalance: employee.paidLeaveBalance,
      tenureDays,
    });
    const reasons: string[] = [];
    if (attendanceDeltaPct < -10) reasons.push(`Attendance down ${Math.abs(Math.round(attendanceDeltaPct))} pts vs prior period`);
    if (sickLeaveDays30 > 0) reasons.push(`${sickLeaveDays30} sick day(s) in period`);
    if (unpaidLeaveDays30 > 0) reasons.push(`${unpaidLeaveDays30} unpaid day(s) in period`);
    if (employee.paidLeaveBalance >= 15 && attendanceDeltaPct < -5) {
      reasons.push("High unused leave with falling attendance");
    }
    if (tenureDays < 90) reasons.push("First 90 days");
    if (reasons.length === 0) reasons.push("Baseline operational signals");

    flightRisk.push({
      employeeId: employee.employeeId,
      name: employee.fullName,
      department: employee.department,
      score,
      reasons,
    });
    modelEmployees.push({
      name: employee.fullName,
      bankAccount: employee.bankAccount,
      wage: employee.wage,
      flightRisk: score,
      department: employee.department,
      tenureDays,
    });
  }

  flightRisk.sort((a, b) => b.score - a.score);

  const departments = departmentAttendance(
    input.employees.map((employee) => {
      const bucket = countsByUser.get(employee.userId)!;
      return {
        department: employee.department,
        expectedDays,
        presentDays: bucket.present,
        halfDays: bucket.half,
        absentDays: bucket.absent,
      };
    }),
  );

  const modelInput: InternalSnapshot = {
    health,
    attendancePct,
    departments,
    employees: modelEmployees,
    leave: {
      pending: pendingApprovals,
      approvedDays: leaveDaysApproved,
      clashes: clashCount,
      byType: leaveByType.map((row) => ({ name: row.name, value: row.value })),
    },
    payroll: {
      net: input.canPayroll ? input.payrollNet : null,
      warningPct: input.canPayroll ? input.payrunWarningPct : 0,
    },
  };

  const data: AiAnalyticsData = {
    periodLabel: `${input.periodStart} → ${input.periodEnd}`,
    health,
    attendancePct,
    leaveDaysApproved,
    pendingApprovals,
    payrollNet: input.canPayroll ? input.payrollNet : null,
    weeklyAttendance: input.weeklyAttendance,
    leaveByType,
    insights: input.insights,
    flightRisk: input.canPeople ? flightRisk : [],
    aiEnabled: input.aiEnabled,
  };

  return { data, modelInput };
}
