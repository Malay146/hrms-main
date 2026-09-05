export type AttendanceRateInput = {
  expectedDays: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
};

/** Present days plus half-days as 0.5, as a percent of expected working days. */
export function attendanceRate(input: AttendanceRateInput): number {
  if (input.expectedDays <= 0) return 0;
  const attended = input.presentDays + input.halfDays * 0.5;
  return Math.round((attended / input.expectedDays) * 1000) / 10;
}

export type LeaveRange = {
  department: string;
  start: string;
  end: string;
};

function overlaps(a: LeaveRange, b: LeaveRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Pairwise overlapping leave ranges inside the same department. */
export function leaveClashCount(rows: LeaveRange[]): number {
  let clashes = 0;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].department === rows[j].department && overlaps(rows[i], rows[j])) {
        clashes += 1;
      }
    }
  }
  return clashes;
}

export type FlightRiskInput = {
  attendanceDeltaPct: number;
  sickLeaveDays30: number;
  unpaidLeaveDays30: number;
  paidBalance: number;
  tenureDays: number;
};

/** Deterministic 0–100 proxy from attendance and leave signals. */
export function flightRiskScore(input: FlightRiskInput): number {
  let score = 10;
  if (input.attendanceDeltaPct < -10) score += Math.min(35, Math.abs(input.attendanceDeltaPct));
  score += Math.min(25, input.sickLeaveDays30 * 4);
  score += Math.min(15, input.unpaidLeaveDays30 * 5);
  if (input.paidBalance >= 15 && input.attendanceDeltaPct < -5) score += 10;
  if (input.tenureDays < 90 || input.tenureDays > 540) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type HealthInput = {
  attendancePct: number;
  pendingLeavePerEmployee: number;
  inactivePct: number;
  payrunWarningPct: number;
};

export type HealthBand = "healthy" | "watch" | "at_risk";

export function workforceHealthScore(input: HealthInput): {
  score: number;
  band: HealthBand;
  parts: { key: string; value: number }[];
} {
  const attendancePts = Math.max(0, Math.min(40, (input.attendancePct / 100) * 40));
  const leavePts = Math.max(0, 25 - input.pendingLeavePerEmployee * 80);
  const inactivePts = Math.max(0, 20 - input.inactivePct * 0.8);
  const payrollPts = Math.max(0, 15 - input.payrunWarningPct * 0.3);
  const score = Math.round(attendancePts + leavePts + inactivePts + payrollPts);
  const band: HealthBand = score >= 80 ? "healthy" : score >= 55 ? "watch" : "at_risk";
  return {
    score,
    band,
    parts: [
      { key: "attendance", value: Math.round(attendancePts) },
      { key: "leaveBacklog", value: Math.round(leavePts) },
      { key: "inactive", value: Math.round(inactivePts) },
      { key: "payroll", value: Math.round(payrollPts) },
    ],
  };
}

export function lateRate(lateFlags: boolean[]): number {
  if (lateFlags.length === 0) return 0;
  const late = lateFlags.filter(Boolean).length;
  return Math.round((late / lateFlags.length) * 1000) / 10;
}

export type DepartmentAttendanceInput = AttendanceRateInput & { department: string };

export type DepartmentAttendanceRow = {
  name: string;
  attendancePct: number;
  headcount: number;
};

export function departmentAttendance(rows: DepartmentAttendanceInput[]): DepartmentAttendanceRow[] {
  const grouped = new Map<string, AttendanceRateInput & { headcount: number }>();
  for (const row of rows) {
    const current = grouped.get(row.department) ?? {
      expectedDays: 0,
      presentDays: 0,
      halfDays: 0,
      absentDays: 0,
      headcount: 0,
    };
    current.expectedDays += row.expectedDays;
    current.presentDays += row.presentDays;
    current.halfDays += row.halfDays;
    current.absentDays += row.absentDays;
    current.headcount += 1;
    grouped.set(row.department, current);
  }
  return [...grouped.entries()].map(([name, value]) => ({
    name,
    headcount: value.headcount,
    attendancePct: attendanceRate(value),
  }));
}

export function payrollOutlierFlags(nets: number[]): boolean[] {
  if (nets.length < 2) return nets.map(() => false);
  const mean = nets.reduce((sum, value) => sum + value, 0) / nets.length;
  const variance = nets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (nets.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return nets.map(() => false);
  return nets.map((value) => Math.abs(value - mean) > 2 * std);
}

function utcDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function weekdayCount(startKey: string, endKey: string): number {
  const start = new Date(`${startKey}T00:00:00.000Z`);
  const end = new Date(`${endKey}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function addDaysToKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
