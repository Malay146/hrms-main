import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "dotenv/config";
import { findApiOperation, apiOperations } from "./operations";
import { buildOpenApiDocument } from "./openapi";

describe("HRMS v1 API catalog", () => {
  it("matches parameterized department routes", () => {
    const listed = findApiOperation("GET", "/departments");
    assert.equal(listed?.operation.operationId, "listDepartments");

    const created = findApiOperation("POST", "/departments");
    assert.equal(created?.operation.operationId, "createDepartment");

    const renamed = findApiOperation("PATCH", "/departments/abc");
    assert.equal(renamed?.operation.operationId, "renameDepartment");
    assert.equal(renamed?.params.id, "abc");
  });

  it("does not collide list and detail employee routes", () => {
    const list = findApiOperation("GET", "/employees");
    const detail = findApiOperation("GET", "/employees/EMP001");
    assert.equal(list?.operation.operationId, "listEmployees");
    assert.equal(detail?.operation.operationId, "getEmployee");
    assert.equal(detail?.params.employeeId, "EMP001");
  });

  it("publishes a complete OpenAPI document", () => {
    const spec = buildOpenApiDocument();
    assert.equal(spec.openapi, "3.0.3");
    assert.ok(spec.paths["/api/v1/departments"]?.post);
    assert.ok(spec.paths["/api/v1/employees"]?.get);
    assert.ok(spec.paths["/api/auth/sign-in/email"]?.post);
    assert.ok(spec.paths["/api/cron/payslips"]?.post);
    assert.ok(apiOperations.length >= 80);
    const operationIds = apiOperations.map((row) => row.operationId);
    assert.equal(new Set(operationIds).size, operationIds.length);
  });
});
