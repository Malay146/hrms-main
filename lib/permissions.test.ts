import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessAdminPath, hasPermission } from "./permissions";

describe("payroll role matrix", () => {
  it("blocks HR Manager from payroll", () => {
    assert.equal(hasPermission("hr_manager", "viewPayrollAll"), false);
    assert.equal(canAccessAdminPath("hr_manager", "/admin/hr/payroll"), false);
  });

  it("gives payroll user edit and read-only salary config", () => {
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
});
