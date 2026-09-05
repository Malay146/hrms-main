import type { Role } from "@/lib/types";

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
  | "createUsers"
  | "approveLeave"
  | "viewPayrollAll"
  | "editPayroll"
  | "adminExtras";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "viewAdminDashboard",
    "managePeople",
    "createUsers",
    "approveLeave",
    "viewPayrollAll",
    "editPayroll",
    "adminExtras",
  ],
  hr_manager: ["viewAdminDashboard", "managePeople", "approveLeave"],
  hr_payroll_manager: ["viewAdminDashboard", "viewPayrollAll", "editPayroll"],
  hr_payroll_user: ["viewAdminDashboard", "viewPayrollAll"],
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
  if (pathname.startsWith("/admin/people/employees")) {
    return hasPermission(current, "managePeople");
  }
  if (pathname.startsWith("/admin/people/attendance")) {
    return hasPermission(current, "managePeople");
  }
  if (pathname.startsWith("/admin/people/leave")) {
    return hasPermission(current, "approveLeave");
  }
  if (pathname.startsWith("/admin/hr/payroll")) {
    return hasPermission(current, "viewPayrollAll");
  }
  if (pathname.startsWith("/admin/notifications") || pathname.startsWith("/admin/settings")) {
    return true;
  }
  if (
    pathname.startsWith("/admin/people/department") ||
    pathname.startsWith("/admin/hr/recruitment") ||
    pathname.startsWith("/admin/hr/performance") ||
    pathname.startsWith("/admin/analytics")
  ) {
    return true;
  }
  return hasPermission(current, "adminExtras");
}

export function firstAllowedAdminPath(role: Role | string | undefined): string {
  if (hasPermission(role, "viewAdminDashboard")) return "/admin";
  if (hasPermission(role, "viewPayrollAll")) return "/admin/hr/payroll";
  if (hasPermission(role, "managePeople")) return "/admin/people/employees";
  return "/login";
}
