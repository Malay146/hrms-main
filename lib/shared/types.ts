export type Role =
  | "admin"
  | "hr_manager"
  | "hr_payroll_user"
  | "hr_payroll_manager"
  | "employee";
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
  mustChangePassword: boolean;
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
  employeeCode: string | null;
  name: string;
  email: string;
  avatar: string;
  department: string;
  date: string;
  dateKey: string;
  checkIn: string;
  checkOut: string;
  workingHours: string;
  workedHours: number | null;
  overtimeHours: number | null;
  status: string;
  late: boolean;
  manualEdit: boolean;
  missingCheckout: boolean;
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
  greeting: string;
  todayLabel: string;
  totalEmployees: number;
  presentToday: number;
  leaveToday: number;
  pendingApprovals: number;
  weeklyAttendance: { day: string; attendance: number }[];
  recentLeaves: LeaveListItem[];
  distribution: { name: string; value: number; color: string; percentage: string }[];
  activities: { text: string; time: string }[];
  performance: {
    avgRating: number | null;
    pendingReviews: number;
    submittedReviews: number;
    href: string;
  } | null;
};

export type EmployeeDashboardData = {
  firstName: string;
  greeting: string;
  todayLabel: string;
  isClockedIn: boolean;
  checkInLabel: string;
  workedHours: string;
  remainingLeave: number;
  upcomingLabel: string;
  latestRating: number | null;
  weeklyHours: { day: string; hours: number }[];
};

export type AiInsightCard = {
  id: string;
  severity: "info" | "watch" | "alert";
  title: string;
  body: string;
  action: string;
  href?: string;
  metricKey?: string;
};

export type AiFlightRiskRow = {
  employeeId: string;
  name: string;
  department: string;
  score: number;
  reasons: string[];
};

export type AiAnalyticsData = {
  periodLabel: string;
  health: {
    score: number;
    band: "healthy" | "watch" | "at_risk";
    parts: { key: string; value: number }[];
  };
  attendancePct: number;
  leaveDaysApproved: number;
  pendingApprovals: number;
  payrollNet: number | null;
  weeklyAttendance: { day: string; attendance: number }[];
  leaveByType: { name: string; value: number; color: string; percentage: string }[];
  insights: AiInsightCard[];
  flightRisk: AiFlightRiskRow[];
  latePct: number;
  departmentAttendance: { name: string; attendancePct: number; headcount: number }[];
  performance: {
    avgRating: number | null;
    pendingReviews: number;
    submittedReviews: number;
  };
  aiEnabled: boolean;
};

export type AiCopilotResult = {
  answer: string;
  source: string;
  conversationId: string;
  acted: boolean;
  needsConfirmation: boolean;
  confirmationSummary: string | null;
};

export type CopilotHistoryItem = {
  id: string;
  role: "user" | "assistant";
  body: string;
  source: string | null;
  createdAt: string;
};

export type CopilotConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
};

export type AiLeaveBrief = {
  leaveId: string;
  bullets: string[];
  suggestion: "approve" | "review" | "reject";
  clashCount: number;
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
