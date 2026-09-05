import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  sqlAttendanceSummaryQuery,
  sqlLeaveTodayQuery,
  sqlPendingLeaveQuery,
} from "./copilot-query-sql";

function sqlText(query: { strings?: readonly string[]; sql?: string }) {
  if (typeof query.sql === "string") return query.sql;
  if (query.strings) return query.strings.join("?");
  return String(query);
}

const FACT_MIGRATION_PATH = join(
  process.cwd(),
  "prisma/migrations/20260906030000_fact_table_org_employee/migration.sql",
);

describe("copilot leave and attendance SQL", () => {
  it("filters leave today by leave_request.organizationId and profile employeeId", () => {
    const sql = sqlText(sqlLeaveTodayQuery("org_1", new Date("2026-09-06")));
    assert.match(sql, /leave_request/);
    assert.match(sql, /lr\."organizationId"/);
    assert.match(sql, /p\.id\s*=\s*lr\."employeeId"/);
    assert.doesNotMatch(sql, /INNER JOIN "user"/);
  });

  it("filters pending leave by leave_request.organizationId and profile employeeId", () => {
    const sql = sqlText(sqlPendingLeaveQuery("org_1"));
    assert.match(sql, /leave_request/);
    assert.match(sql, /lr\."organizationId"/);
    assert.match(sql, /p\.id\s*=\s*lr\."employeeId"/);
    assert.doesNotMatch(sql, /INNER JOIN "user"/);
  });

  it("filters attendance summary by attendance.organizationId and profile employeeId", () => {
    const sql = sqlText(
      sqlAttendanceSummaryQuery("org_1", new Date("2026-09-01"), new Date("2026-09-06")),
    );
    assert.match(sql, /attendance/);
    assert.match(sql, /a\."organizationId"/);
    assert.match(sql, /p\.id\s*=\s*a\."employeeId"/);
    assert.doesNotMatch(sql, /INNER JOIN "user"/);
  });
});

describe("fact table org employee migration", () => {
  it("adds organizationId and employeeId on attendance and leave_request", () => {
    assert.ok(existsSync(FACT_MIGRATION_PATH), `expected migration at ${FACT_MIGRATION_PATH}`);
    const sql = readFileSync(FACT_MIGRATION_PATH, "utf8");
    assert.match(sql, /ALTER TABLE "attendance" ADD COLUMN "organizationId"/);
    assert.match(sql, /ALTER TABLE "attendance" ADD COLUMN "employeeId"/);
    assert.match(sql, /ALTER TABLE "leave_request" ADD COLUMN "organizationId"/);
    assert.match(sql, /ALTER TABLE "leave_request" ADD COLUMN "employeeId"/);
    assert.match(sql, /attendance_matches_profile/);
    assert.match(sql, /leave_request_matches_profile/);
  });
});
