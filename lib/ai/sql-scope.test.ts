import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SQL_ALLOWED_TABLES } from "./sql-guard";
import { scopeSqlToOrganization } from "./sql-scope";

const columns = Object.fromEntries(SQL_ALLOWED_TABLES.map((t) => [t, ["id", "organizationId", "name"]]));

describe("scopeSqlToOrganization", () => {
  it("shadows every allowed table with an org-filtered CTE", () => {
    const out = scopeSqlToOrganization(`SELECT count(*) FROM attendance WHERE "organizationId" = $1`, columns);
    assert.match(out, /^WITH employee_profile AS \(SELECT "id", "organizationId", "name" FROM public\.employee_profile WHERE "organizationId" = \$1\)/);
    assert.match(out, /attendance AS \(SELECT .* FROM public\.attendance WHERE "organizationId" = \$1\)/);
    assert.match(out, /contract AS \(.*"employeeId" IN \(SELECT id FROM public\.employee_profile WHERE "organizationId" = \$1\)\)/);
    assert.ok(out.endsWith(`SELECT count(*) FROM attendance WHERE "organizationId" = $1`));
  });

  it("merges with the model's own WITH clause", () => {
    const out = scopeSqlToOrganization(`WITH x AS (SELECT 1 FROM attendance) SELECT * FROM x`, columns);
    assert.match(out, /candidate AS \(.*\),\nx AS \(SELECT 1 FROM attendance\) SELECT \* FROM x$/);
    assert.equal(out.match(/^WITH /gm)?.length, 1);
  });

  it("selects only the listed readable columns", () => {
    const out = scopeSqlToOrganization(`SELECT * FROM employee_profile`, { ...columns, employee_profile: ["id", "fullName"] });
    assert.match(out, /employee_profile AS \(SELECT "id", "fullName" FROM public\.employee_profile/);
  });

  it("rejects recursive queries", () => {
    assert.throws(() => scopeSqlToOrganization(`WITH RECURSIVE r AS (SELECT 1) SELECT * FROM r`, columns));
  });
});
