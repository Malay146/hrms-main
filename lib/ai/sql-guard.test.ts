import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guardSelectSql } from "./sql-guard";

const OK = `SELECT COUNT(*)::int AS "total" FROM employee_profile WHERE "organizationId" = $1`;

describe("guardSelectSql", () => {
  it("accepts an org-scoped aggregate and appends a limit", () => {
    const result = guardSelectSql(OK);
    assert.equal(result.ok, true);
    assert.match(result.ok ? result.sql : "", /LIMIT 60$/);
  });

  it("keeps an existing top-level limit", () => {
    const result = guardSelectSql(`${OK} LIMIT 5`);
    assert.equal(result.ok, true);
    assert.equal((result.ok ? result.sql : "").match(/LIMIT/g)?.length, 1);
  });

  it("still appends a limit when LIMIT only appears in a subquery", () => {
    const sql = `SELECT d.name FROM department d WHERE d."organizationId" = $1 AND d.id IN (SELECT "departmentId" FROM employee_profile WHERE "organizationId" = $1 LIMIT 3)`;
    const result = guardSelectSql(sql);
    assert.equal(result.ok, true);
    assert.match(result.ok ? result.sql : "", /LIMIT 60$/);
  });

  it("strips markdown fences and a trailing semicolon", () => {
    const result = guardSelectSql("```sql\n" + OK + ";\n```");
    assert.equal(result.ok, true);
  });

  it("does not read EXTRACT(... FROM col) as a table reference", () => {
    const sql = `SELECT COUNT(*)::int AS "joined" FROM employee_profile WHERE "organizationId" = $1 AND EXTRACT(YEAR FROM "joinDate") = 2026`;
    assert.equal(guardSelectSql(sql).ok, true);
  });

  it("still blocks a bad table inside a query that uses EXTRACT", () => {
    const sql = `SELECT EXTRACT(YEAR FROM "joinDate") FROM "session" WHERE "organizationId" = $1`;
    assert.equal(guardSelectSql(sql).ok, false);
  });

  it("accepts a leading CTE", () => {
    const sql = `WITH people AS (SELECT id FROM employee_profile WHERE "organizationId" = $1) SELECT COUNT(*)::int FROM people`;
    assert.equal(guardSelectSql(sql).ok, true);
  });

  for (const [label, sql] of [
    ["a write", `DELETE FROM employee_profile WHERE "organizationId" = $1`],
    ["a second statement", `${OK}; DROP TABLE department`],
    ["a comment", `${OK} -- drop`],
    ["SELECT INTO", `SELECT id INTO x FROM employee_profile WHERE "organizationId" = $1`],
    ["an unscoped read", `SELECT COUNT(*) FROM employee_profile`],
    ["a table outside the allow list", `SELECT * FROM "user" WHERE "organizationId" = $1`],
    ["a catalog probe", `SELECT * FROM pg_tables WHERE "organizationId" = $1`],
    ["a wage column", `SELECT wage FROM employee_profile WHERE "organizationId" = $1`],
    ["a bank column", `SELECT "bankAccount" FROM employee_profile WHERE "organizationId" = $1`],
    ["an extra bind parameter", `${OK} AND "jobTitle" = $2`],
    ["an empty query", ""],
  ] as const) {
    it(`rejects ${label}`, () => {
      assert.equal(guardSelectSql(sql).ok, false);
    });
  }
});
