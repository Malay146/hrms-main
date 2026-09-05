import {
  ATTENDANCE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  type AttendanceLogItem,
  type AttendanceStatus,
  type EmployeeListItem,
  type LeaveListItem,
  type LeaveType,
  type PayrollListItem,
} from "@/lib/shared/types";
import {
  formatDisplayDate,
  formatDisplayTime,
  formatHours,
  formatPayrollMonth,
  inclusiveDayCount,
  isLateCheckIn,
  kolkataTodayKey,
  toDateKey,
  workingHours,
} from "@/lib/shared/dates";
import { deriveAttendanceMetrics } from "@/lib/people/attendance-metrics";
import { initialsFromName } from "@/lib/people/employee-id";

export function departmentName(
  department: string | { name: string } | null | undefined,
): string {
  if (!department) return "—";
  return typeof department === "string" ? department : department.name;
}

export function leaveTypeFromCode(code: string): LeaveType {
  if (code === "sick") return "sick";
  if (code === "unpaid") return "unpaid";
  return "paid";
}

export function mapEmployeeStatus(status: string, onLeaveToday: boolean) {
  if (status === "inactive") return "Inactive";
  if (onLeaveToday || status === "on_leave") return "On Leave";
  return "Active";
}

export function mapEmployee(
  row: {
    userId: string;
    employeeId: string;
    fullName: string;
    department?: string | { name: string } | null;
    jobTitle: string;
    phone: string | null;
    status: string;
    createdAt: Date;
    employeeType?: string | null;
    joinDate?: Date | null;
    user: { email: string };
  },
  onLeaveToday: boolean,
): EmployeeListItem {
  const typeLabel =
    row.employeeType === "intern"
      ? "Intern"
      : row.employeeType === "contractor"
        ? "Contractor"
        : "Full-time";
  return {
    id: row.employeeId,
    userId: row.userId,
    employeeId: row.employeeId,
    name: row.fullName,
    email: row.user.email,
    avatar: initialsFromName(row.fullName),
    department: departmentName(row.department),
    designation: row.jobTitle,
    type: typeLabel,
    joinDate: formatDisplayDate(row.joinDate ?? row.createdAt),
    status: mapEmployeeStatus(row.status, onLeaveToday),
    phone: row.phone,
  };
}

export function mapAttendance(row: {
  id: string;
  userId: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: AttendanceStatus;
  workedHours?: { toString(): string } | number | null;
  overtimeHours?: { toString(): string } | number | null;
  manualEdit?: boolean;
  user: {
    email: string;
    profile: {
      fullName: string;
      employeeId?: string | null;
      department?: string | { name: string } | null;
      schedule?: {
        lines: { weekday: number; startMin: number; endMin: number; breakMin: number }[];
      } | null;
    } | null;
  };
}): AttendanceLogItem {
  const dateKey = toDateKey(row.date);
  const todayKey = kolkataTodayKey();
  const metrics = deriveAttendanceMetrics({
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    dateKey,
    todayKey,
    scheduleLines: row.user.profile?.schedule?.lines,
  });
  const storedWorked =
    row.workedHours == null || row.workedHours === undefined
      ? null
      : Number(row.workedHours);
  const workedHours = storedWorked ?? metrics.workedHours;
  const overtimeHours =
    row.overtimeHours == null || row.overtimeHours === undefined
      ? metrics.overtimeHours
      : Number(row.overtimeHours);
  const late =
    row.status === "present" &&
    (metrics.late || isLateCheckIn(row.checkIn, metrics.line?.startMin));
  const name = row.user.profile?.fullName ?? row.user.email;
  return {
    id: row.id,
    userId: row.userId,
    employeeCode: row.user.profile?.employeeId ?? null,
    name,
    email: row.user.email,
    avatar: initialsFromName(name),
    department: departmentName(row.user.profile?.department),
    date: formatDisplayDate(row.date),
    dateKey,
    checkIn: formatDisplayTime(row.checkIn),
    checkOut: formatDisplayTime(row.checkOut),
    workingHours: workedHours == null ? formatHours(workingHours(row.checkIn, row.checkOut)) : formatHours(workedHours),
    workedHours,
    overtimeHours,
    status: late ? "Late" : ATTENDANCE_STATUS_LABELS[row.status],
    late,
    manualEdit: Boolean(row.manualEdit),
    missingCheckout: metrics.missingCheckout,
  };
}

export function mapLeave(row: {
  id: string;
  userId: string;
  type?: LeaveType | { code: string; name: string };
  startDate: Date;
  endDate: Date;
  remarks: string;
  adminComment: string | null;
  status: string;
  user: {
    email: string;
    profile: {
      fullName: string;
      department?: string | { name: string } | null;
    } | null;
  };
}): LeaveListItem {
  const name = row.user.profile?.fullName ?? row.user.email;
  const startDate = toDateKey(row.startDate);
  const endDate = toDateKey(row.endDate);
  const days = inclusiveDayCount(startDate, endDate);
  const leaveType: LeaveType =
    typeof row.type === "string"
      ? row.type
      : leaveTypeFromCode(row.type?.code ?? "paid");
  return {
    id: row.id,
    userId: row.userId,
    name,
    email: row.user.email,
    avatar: initialsFromName(name),
    department: departmentName(row.user.profile?.department),
    leaveType: row.type && typeof row.type !== "string" ? row.type.name : LEAVE_TYPE_LABELS[leaveType],
    type: leaveType,
    duration: `${days} Day${days === 1 ? "" : "s"}`,
    from: formatDisplayDate(startDate),
    to: formatDisplayDate(endDate),
    startDate,
    endDate,
    remarks: row.remarks,
    adminComment: row.adminComment,
    status: row.status[0].toUpperCase() + row.status.slice(1),
  };
}

export function mapPayroll(row: {
  id: string;
  userId: string;
  month: string;
  basic: { toString(): string };
  hraPct: { toString(): string };
  allowancePct: { toString(): string };
  deductions: { toString(): string };
  netSalary: { toString(): string };
  user: {
    email: string;
    profile: {
      employeeId: string;
      fullName: string;
      department?: string | { name: string } | null;
      jobTitle: string;
    } | null;
  };
}): PayrollListItem {
  const name = row.user.profile?.fullName ?? row.user.email;
  return {
    id: row.id,
    userId: row.userId,
    employeeId: row.user.profile?.employeeId ?? "—",
    name,
    email: row.user.email,
    avatar: initialsFromName(name),
    role: row.user.profile?.jobTitle ?? "Employee",
    department: departmentName(row.user.profile?.department),
    month: row.month,
    monthLabel: formatPayrollMonth(row.month),
    basic: Number(row.basic),
    hraPct: Number(row.hraPct),
    allowancePct: Number(row.allowancePct),
    deductions: Number(row.deductions),
    netSalary: Number(row.netSalary),
  };
}

export const PIE_COLORS = [
  "#18181B",
  "#3F3F46",
  "#52525B",
  "#71717A",
  "#A1A1AA",
  "#D4D4D8",
  "#27272A",
  "#09090B",
  "#636363",
  "#8A8A8A",
];
