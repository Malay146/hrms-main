import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INVARIANT_SQL } from "./invariants";

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
    assert.match(INVARIANT_SQL.checks.workingScheduleLineWeekday, /weekday["\s]*>=["\s]*0/i);
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

  it.skip(
    "live Postgres probe waits until CHECK constraints exist (Task 2)",
    () => {
      assert.fail("constraints not applied yet");
    },
  );
});
