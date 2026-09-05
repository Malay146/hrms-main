export type Role = "admin" | "employee";
export type EmployeeStatus = "active" | "inactive" | "on_leave";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export type LeaveType = "paid" | "sick" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  phone: string | null;
  status: EmployeeStatus | null;
  paidLeaveBalance: number | null;
};

export type EmployeeListItem = {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  avatar: string;
  department: string;
  designation: string;
  type: string;
  joinDate: string;
  status: string;
  phone: string | null;
};

export type AttendanceLogItem = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string;
  department: string;
  date: string;
  checkIn: string;
  checkOut: string;
  workingHours: string;
  status: string;
  late: boolean;
};

export type LeaveListItem = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string;
  department: string;
  leaveType: string;
  type: LeaveType;
  duration: string;
  from: string;
  to: string;
  startDate: string;
  endDate: string;
  remarks: string;
  adminComment: string | null;
  status: string;
};

export type PayrollListItem = {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  department: string;
  month: string;
  monthLabel: string;
  basic: number;
  hraPct: number;
  allowancePct: number;
  deductions: number;
  netSalary: number;
};

export type CalendarMarker = {
  date: string;
  kind: "present" | "absent" | "leave";
};

export type DashboardStats = {
  firstName: string;
  todayLabel: string;
  totalEmployees: number;
  presentToday: number;
  leaveToday: number;
  pendingApprovals: number;
  weeklyAttendance: { day: string; attendance: number }[];
  recentLeaves: LeaveListItem[];
  distribution: { name: string; value: number; color: string; percentage: string }[];
  activities: { text: string; time: string }[];
};

export type EmployeeDashboardData = {
  firstName: string;
  todayLabel: string;
  isClockedIn: boolean;
  checkInLabel: string;
  workedHours: string;
  remainingLeave: number;
  weeklyHours: { day: string; hours: number }[];
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  paid: "Paid Leave",
  sick: "Sick Leave",
  unpaid: "Unpaid Leave",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  leave: "Leave",
};
