import "dotenv/config";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { INVARIANT_SQL } from "./invariants";

const CHECK_MIGRATION_PATH = join(
  process.cwd(),
  "prisma/migrations/20260906010000_check_constraints/migration.sql",
);

const UNIQUE_MIGRATION_PATH = join(
  process.cwd(),
  "prisma/migrations/20260906020000_bcnf_unique_keys/migration.sql",
);

const EXCLUSION_MIGRATION_PATH = join(
  process.cwd(),
  "prisma/migrations/20260906040000_leave_exclusion/migration.sql",
);

const CHECK_CONSTRAINT_NAMES = Object.values(INVARIANT_SQL.checks).map((sql) => {
  const match = sql.match(/ADD CONSTRAINT "([^"]+)"/);
  assert.ok(match, `CHECK SQL must name a constraint:\n${sql}`);
  return match[1];
});

describe("db invariants catalog", () => {
  it("includes a leave date order check", () => {
    assert.match(INVARIANT_SQL.checks.leaveDatesOrdered, /endDate["\s]*>=["\s]*startDate/i);
  });

  it("includes a leave duration nonneg check", () => {
    assert.match(INVARIANT_SQL.checks.leaveDurationNonneg, /duration["\s]*>=["\s]*0/i);
  });

  it("includes a contract date order check", () => {
    assert.match(INVARIANT_SQL.checks.contractDatesOrdered, /endDate["\s]*>=["\s]*startDate/i);
  });

  it("includes a contract wage nonneg check", () => {
    assert.match(INVARIANT_SQL.checks.contractWageNonneg, /wage["\s]*>=["\s]*0/i);
  });

  it("includes an attendance checkout-needs-checkin check", () => {
    assert.match(INVARIANT_SQL.checks.attendanceCheckoutNeedsCheckin, /checkOut[\s\S]*checkIn/i);
  });

  it("includes a schedule line weekday check", () => {
    const sql = INVARIANT_SQL.checks.workingScheduleLineWeekday;
    assert.match(sql, /weekday["\s]*>=["\s]*1/i);
    assert.match(sql, /weekday["\s]*<=["\s]*7/i);
  });

  it("includes a schedule line range check", () => {
    assert.match(INVARIANT_SQL.checks.workingScheduleLineRange, /endMin["\s]*>["\s]*startMin/i);
  });

  it("includes a schedule hours positive check", () => {
    assert.match(INVARIANT_SQL.checks.workingScheduleHoursPositive, /hoursPerWeek["\s]*>["\s]*0/i);
  });

  it("includes an allocation amounts check", () => {
    assert.match(INVARIANT_SQL.checks.timeOffAllocationAmounts, /taken["\s]*<=["\s]*allocated/i);
  });

  it("includes a payslip amounts nonneg check", () => {
    assert.match(INVARIANT_SQL.checks.payslipAmountsNonneg, /wage["\s]*>=["\s]*0/i);
  });

  it("includes a performance goal progress check", () => {
    assert.match(INVARIANT_SQL.checks.performanceGoalProgress, /progress["\s]*<=["\s]*100/i);
  });

  it("includes one schedule line per weekday unique index", () => {
    assert.match(
      INVARIANT_SQL.uniques.scheduleLineOnePerWeekday,
      /CREATE UNIQUE INDEX "working_schedule_line_scheduleId_weekday_key"/i,
    );
    assert.match(
      INVARIANT_SQL.uniques.scheduleLineOnePerWeekday,
      /ON "working_schedule_line" \("scheduleId", "weekday"\)/,
    );
  });

  it("includes allocation unique per employee type year", () => {
    assert.match(
      INVARIANT_SQL.uniques.allocationUniquePerYear,
      /CREATE UNIQUE INDEX "time_off_allocation_employee_type_year_key"/i,
    );
    assert.match(
      INVARIANT_SQL.uniques.allocationUniquePerYear,
      /ON "time_off_allocation" \("employeeId", "typeId", "validityYear"\)/,
    );
  });

  it("includes btree_gist overlapping leave exclusion", () => {
    const sql = INVARIANT_SQL.exclusion.noOverlappingApprovedLeave;
    assert.match(sql, /EXCLUDE USING gist/i);
    assert.match(sql, /btree_gist/i);
    assert.match(sql, /"employeeId" WITH =/);
    assert.match(sql, /daterange\("startDate", "endDate", '\[\]'\)/);
    assert.match(sql, /status = 'approved'/);
  });

  it("bcnf-unique-keys payrun dedup aborts instead of deleting paid or validated payroll", () => {
    const sql = readFileSync(UNIQUE_MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");
    const payrunStart = sql.indexOf("-- One payrun per org");
    assert.ok(payrunStart >= 0, "expected a payrun dedup section");
    const payrunSql = sql.slice(
      payrunStart,
      sql.indexOf("-- Idempotent recreate") >= payrunStart
        ? sql.indexOf("-- Idempotent recreate")
        : sql.indexOf("-- Department names unique per org (case-insensitive) — SQL-only"),
    );
    assert.match(payrunSql, /RAISE EXCEPTION/i);
    assert.match(payrunSql, /paid|validated/);
    assert.match(payrunSql, /status\s+IN\s*\(\s*'paid'\s*,\s*'validated'\s*\)/i);
  });

  it("employees.ts does not findUnique EmployeeProfile by employeeId alone", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/actions/people/employees.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      src,
      /employeeProfile\.findUnique\(\s*\{\s*where:\s*\{\s*employeeId\b/,
    );
  });

  it("bcnf-unique-keys migration includes every INVARIANT_SQL.uniques snippet verbatim", () => {
    assert.ok(
      existsSync(UNIQUE_MIGRATION_PATH),
      `expected migration at ${UNIQUE_MIGRATION_PATH}`,
    );
    const sql = readFileSync(UNIQUE_MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");
    for (const [name, snippet] of Object.entries(INVARIANT_SQL.uniques)) {
      assert.ok(
        sql.includes(snippet),
        `migration must include INVARIANT_SQL.uniques.${name} verbatim`,
      );
    }
  });

  it("leave-exclusion migration includes INVARIANT_SQL.exclusion.noOverlappingApprovedLeave verbatim", () => {
    assert.ok(
      existsSync(EXCLUSION_MIGRATION_PATH),
      `expected migration at ${EXCLUSION_MIGRATION_PATH}`,
    );
    const sql = readFileSync(EXCLUSION_MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");
    assert.ok(
      sql.includes(INVARIANT_SQL.exclusion.noOverlappingApprovedLeave),
      "migration must include INVARIANT_SQL.exclusion.noOverlappingApprovedLeave verbatim",
    );
    assert.match(sql, /status\s*=\s*'rejected'/i);
    assert.match(sql, /overlapping approved leave \(constraint migration\)/);
    assert.doesNotMatch(sql, /DELETE\s+FROM\s+"leave_request"/i);
    assert.doesNotMatch(sql, /DELETE\s+FROM\s+"payslip"/i);
  });

  it("check-constraints migration includes every INVARIANT_SQL.checks snippet verbatim", () => {
    assert.ok(
      existsSync(CHECK_MIGRATION_PATH),
      `expected migration at ${CHECK_MIGRATION_PATH}`,
    );
    const sql = readFileSync(CHECK_MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");
    for (const [name, snippet] of Object.entries(INVARIANT_SQL.checks)) {
      assert.ok(
        sql.includes(snippet),
        `migration must include INVARIANT_SQL.checks.${name} verbatim`,
      );
    }
  });

  it("check-constraints migration swaps inverted dates and repairs ranges without fighting UPDATEs", () => {
    const sql = readFileSync(CHECK_MIGRATION_PATH, "utf8").replace(/\r\n/g, "\n");
    assert.match(
      sql,
      /SET\s+"startDate"\s*=\s*"endDate"\s*,\s*"endDate"\s*=\s*"startDate"/,
    );
    assert.match(sql, /\("endDate"\s*-\s*"startDate"\)\s*\+\s*1/);
    assert.match(sql, /LEAST\s*\(\s*1440\s*,\s*"startMin"\s*\+\s*60\s*\)/i);
    assert.match(sql, /RAISE EXCEPTION/i);
    assert.doesNotMatch(sql, /SET\s+"endMin"\s*=\s*"startMin"\s*\+\s*1/);
  });

  it(
    "live Postgres has the 11 CHECK constraints in pg_constraint",
    { skip: process.env.DATABASE_URL ? false : "DATABASE_URL is unset" },
    async () => {
      assert.equal(CHECK_CONSTRAINT_NAMES.length, 11);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      try {
        const { rows } = await client.query<{ conname: string }>(
          `SELECT conname
           FROM pg_constraint
           WHERE contype = 'c'
             AND conname = ANY($1::text[])`,
          [CHECK_CONSTRAINT_NAMES],
        );
        const found = new Set(rows.map((row) => row.conname));
        for (const name of CHECK_CONSTRAINT_NAMES) {
          assert.ok(found.has(name), `missing CHECK ${name} in pg_constraint`);
        }
      } finally {
        await client.end();
      }
    },
  );
});
