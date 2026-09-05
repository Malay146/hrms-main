import {
  ATTENDANCE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  type AttendanceLogItem,
  type AttendanceStatus,
  type EmployeeListItem,
  type LeaveListItem,
  type LeaveType,
  type PayrollListItem,
} from "@/lib/types";
import {
  formatDisplayDate,
  formatDisplayTime,
  formatHours,
  formatPayrollMonth,
  inclusiveDayCount,
  isLateCheckIn,
  toDateKey,
  workingHours,
} from "@/lib/dates";
import { initialsFromName } from "@/lib/employee-id";

export function mapEmployeeStatus(status: string, onLeaveToday: boolean) {
  if (status === "inactive") return "Inactive";
  if (onLeaveToday || status === "on_leave") return "On Leave";
  return "Active";
}

export function mapEmployee(row: {
  userId: string;
  employeeId: string;
  fullName: string;
  department: string;
  jobTitle: string;
  phone: string | null;
  status: string;
  createdAt: Date;
  user: { email: string };
}, onLeaveToday: boolean): EmployeeListItem {
  return {
    id: row.employeeId,
    userId: row.userId,
    employeeId: row.employeeId,
    name: row.fullName,
    email: row.user.email,
    avatar: initialsFromName(row.fullName),
    department: row.department,
    designation: row.jobTitle,
    type: "Full-time",
    joinDate: formatDisplayDate(row.createdAt),
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
  user: {
    email: string;
    profile: { fullName: string; department: string } | null;
  };
}): AttendanceLogItem {
  const late = row.status === "present" && isLateCheckIn(row.checkIn);
  const name = row.user.profile?.fullName ?? row.user.email;
  return {
    id: row.id,
    userId: row.userId,
    name,
    email: row.user.email,
    avatar: initialsFromName(name),
    department: row.user.profile?.department ?? "—",
    date: formatDisplayDate(row.date),
    checkIn: formatDisplayTime(row.checkIn),
    checkOut: formatDisplayTime(row.checkOut),
    workingHours: formatHours(workingHours(row.checkIn, row.checkOut)),
    status: late ? "Late" : ATTENDANCE_STATUS_LABELS[row.status],
    late,
  };
}

export function mapLeave(row: {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  remarks: string;
  adminComment: string | null;
  status: string;
  user: {
    email: string;
    profile: { fullName: string; department: string } | null;
  };
}): LeaveListItem {
  const name = row.user.profile?.fullName ?? row.user.email;
  const startDate = toDateKey(row.startDate);
  const endDate = toDateKey(row.endDate);
  const days = inclusiveDayCount(startDate, endDate);
  return {
    id: row.id,
    userId: row.userId,
    name,
    email: row.user.email,
    avatar: initialsFromName(name),
    department: row.user.profile?.department ?? "—",
    leaveType: LEAVE_TYPE_LABELS[row.type],
    type: row.type,
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
    profile: { employeeId: string; fullName: string; department: string; jobTitle: string } | null;
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
    department: row.user.profile?.department ?? "—",
    month: row.month,
    monthLabel: formatPayrollMonth(row.month),
    basic: Number(row.basic),
    hraPct: Number(row.hraPct),
    allowancePct: Number(row.allowancePct),
    deductions: Number(row.deductions),
    netSalary: Number(row.netSalary),
  };
}

export const PIE_COLORS = ["#18181B", "#D4D4D8", "#525252", "#737373", "#A3A3A3"];
