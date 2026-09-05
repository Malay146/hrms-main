import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessAdminPath, hasPermission } from "./permissions";

describe("PDF role matrix", () => {
  it("blocks HR Manager from payroll", () => {
    assert.equal(hasPermission("hr_manager", "viewPayrollAll"), false);
    assert.equal(canAccessAdminPath("hr_manager", "/admin/hr/payroll"), false);
  });

  it("gives payroll user people + payroll edit but not salary config write or finalize", () => {
    assert.equal(hasPermission("hr_payroll_user", "managePeople"), true);
    assert.equal(hasPermission("hr_payroll_user", "editPayroll"), true);
    assert.equal(hasPermission("hr_payroll_user", "finalizePayroll"), false);
    assert.equal(hasPermission("hr_payroll_user", "manageSalaryConfig"), false);
    assert.equal(hasPermission("hr_payroll_user", "viewSalaryConfig"), true);
  });

  it("gives payroll manager finalize and salary CRUD", () => {
    assert.equal(hasPermission("hr_payroll_manager", "finalizePayroll"), true);
    assert.equal(hasPermission("hr_payroll_manager", "manageSalaryConfig"), true);
  });

  it("restricts user management to admin", () => {
    assert.equal(hasPermission("hr_payroll_manager", "createUsers"), false);
    assert.equal(hasPermission("admin", "createUsers"), true);
    assert.equal(canAccessAdminPath("admin", "/admin/users"), true);
    assert.equal(canAccessAdminPath("hr_manager", "/admin/users"), false);
  });

  it("gates People and Time Off routes", () => {
    assert.equal(canAccessAdminPath("hr_payroll_user", "/admin/people/contracts"), true);
    assert.equal(canAccessAdminPath("hr_payroll_user", "/admin/people/schedules"), true);
    assert.equal(canAccessAdminPath("hr_manager", "/admin/people/leave/allocations"), true);
    assert.equal(canAccessAdminPath("employee", "/admin/people/employees"), false);
  });
});

describe("AI analytics access", () => {
  it("grants viewAiAnalytics to admin and hr_manager only", () => {
    assert.equal(hasPermission("admin", "viewAiAnalytics"), true);
    assert.equal(hasPermission("hr_manager", "viewAiAnalytics"), true);
    assert.equal(hasPermission("hr_payroll_user", "viewAiAnalytics"), false);
    assert.equal(hasPermission("hr_payroll_manager", "viewAiAnalytics"), false);
    assert.equal(hasPermission("employee", "viewAiAnalytics"), false);
  });

  it("blocks payroll roles and employees from /admin/analytics", () => {
    assert.equal(canAccessAdminPath("admin", "/admin/analytics"), true);
    assert.equal(canAccessAdminPath("hr_manager", "/admin/analytics"), true);
    assert.equal(canAccessAdminPath("hr_payroll_user", "/admin/analytics"), false);
    assert.equal(canAccessAdminPath("employee", "/admin/analytics"), false);
  });
});
