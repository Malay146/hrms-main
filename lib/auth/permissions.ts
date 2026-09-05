import type { Role } from "@/lib/shared/types";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hr_manager: "HR Manager",
  hr_payroll_user: "HR Payroll User",
  hr_payroll_manager: "HR Payroll Manager",
  employee: "Employee",
};

export const ASSIGNABLE_ROLES: Role[] = [
  "employee",
  "hr_manager",
  "hr_payroll_user",
  "hr_payroll_manager",
  "admin",
];

export type Permission =
  | "viewAdminDashboard"
  | "managePeople"
  | "approveLeave"
  | "manageTimeOffTypes"
  | "viewPayrollAll"
  | "editPayroll"
  | "finalizePayroll"
  | "viewSalaryConfig"
  | "manageSalaryConfig"
  | "createUsers"
  | "viewAiAnalytics"
  | "adminExtras";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "viewAdminDashboard",
    "managePeople",
    "approveLeave",
    "manageTimeOffTypes",
    "viewPayrollAll",
    "editPayroll",
    "finalizePayroll",
    "viewSalaryConfig",
    "manageSalaryConfig",
    "createUsers",
    "viewAiAnalytics",
    "adminExtras",
  ],
  hr_manager: [
    "viewAdminDashboard",
    "managePeople",
    "approveLeave",
    "manageTimeOffTypes",
    "viewAiAnalytics",
  ],
  hr_payroll_manager: [
    "viewAdminDashboard",
    "managePeople",
    "approveLeave",
    "manageTimeOffTypes",
    "viewPayrollAll",
    "editPayroll",
    "finalizePayroll",
    "viewSalaryConfig",
    "manageSalaryConfig",
  ],
  hr_payroll_user: [
    "viewAdminDashboard",
    "managePeople",
    "approveLeave",
    "manageTimeOffTypes",
    "viewPayrollAll",
    "editPayroll",
    "viewSalaryConfig",
  ],
  employee: [],
};

export function isStaffRole(role: Role | string | undefined): boolean {
  return Boolean(role) && role !== "employee";
}

export function homePath(role: Role | string | undefined): string {
  return isStaffRole(role) ? "/admin" : "/employee";
}

export function hasPermission(role: Role | string | undefined, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[role as Role].includes(permission);
}

export function canAccessAdminPath(role: Role | string | undefined, pathname: string): boolean {
  if (!isStaffRole(role)) return false;
  const current = role as Role;

  if (pathname === "/admin" || pathname === "/admin/") {
    return hasPermission(current, "viewAdminDashboard");
  }

  if (
    pathname.startsWith("/admin/people/employees") ||
    pathname.startsWith("/admin/people/department") ||
    pathname.startsWith("/admin/people/schedules") ||
    pathname.startsWith("/admin/people/contracts") ||
    pathname.startsWith("/admin/people/attendance")
  ) {
    return hasPermission(current, "managePeople");
  }

  if (
    pathname.startsWith("/admin/people/leave/types") ||
    pathname.startsWith("/admin/people/leave/allocations")
  ) {
    return (
      hasPermission(current, "approveLeave") || hasPermission(current, "manageTimeOffTypes")
    );
  }

  if (pathname.startsWith("/admin/people/leave")) {
    return hasPermission(current, "approveLeave");
  }

  if (
    pathname.startsWith("/admin/hr/payroll/structures") ||
    pathname.startsWith("/admin/hr/payroll/rules")
  ) {
    return hasPermission(current, "viewSalaryConfig");
  }

  if (pathname.startsWith("/admin/hr/payroll")) {
    return hasPermission(current, "viewPayrollAll");
  }

  if (pathname.startsWith("/admin/analytics")) {
    return hasPermission(current, "viewAiAnalytics");
  }

  if (pathname.startsWith("/admin/notifications") || pathname.startsWith("/admin/settings")) {
    return true;
  }

  if (
    pathname.startsWith("/admin/hr/recruitment") ||
    pathname.startsWith("/admin/hr/performance")
  ) {
    return hasPermission(current, "adminExtras");
  }

  return hasPermission(current, "adminExtras");
}

export function firstAllowedAdminPath(role: Role | string | undefined): string {
  if (hasPermission(role, "viewAdminDashboard")) return "/admin";
  if (hasPermission(role, "viewPayrollAll")) return "/admin/hr/payroll";
  if (hasPermission(role, "managePeople")) return "/admin/people/employees";
  return "/login";
}
