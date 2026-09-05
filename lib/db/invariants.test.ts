import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INVARIANT_SQL } from "./invariants";

describe("db invariants catalog", () => {
  it("includes a leave date order check", () => {
    assert.match(INVARIANT_SQL.leaveDatesOrdered, /endDate["\s]*>=["\s]*startDate/i);
  });

  it("includes a leave duration nonneg check", () => {
    assert.match(INVARIANT_SQL.leaveDurationNonneg, /duration["\s]*>=["\s]*0/i);
  });

  it("includes a contract date order check", () => {
    assert.match(INVARIANT_SQL.contractDatesOrdered, /endDate["\s]*>=["\s]*startDate/i);
  });

  it("includes a contract wage nonneg check", () => {
    assert.match(INVARIANT_SQL.contractWageNonneg, /wage["\s]*>=["\s]*0/i);
  });

  it("includes an attendance checkout-needs-checkin check", () => {
    assert.match(INVARIANT_SQL.attendanceCheckoutNeedsCheckin, /checkOut[\s\S]*checkIn/i);
  });

  it("includes a schedule line weekday check", () => {
    assert.match(INVARIANT_SQL.workingScheduleLineWeekday, /weekday["\s]*>=["\s]*0/i);
  });

  it("includes a schedule line range check", () => {
    assert.match(INVARIANT_SQL.workingScheduleLineRange, /endMin["\s]*>["\s]*startMin/i);
  });

  it("includes a schedule hours positive check", () => {
    assert.match(INVARIANT_SQL.workingScheduleHoursPositive, /hoursPerWeek["\s]*>["\s]*0/i);
  });

  it("includes an allocation amounts check", () => {
    assert.match(INVARIANT_SQL.timeOffAllocationAmounts, /taken["\s]*<=["\s]*allocated/i);
  });

  it("includes a payslip amounts nonneg check", () => {
    assert.match(INVARIANT_SQL.payslipAmountsNonneg, /wage["\s]*>=["\s]*0/i);
  });

  it("includes a performance goal progress check", () => {
    assert.match(INVARIANT_SQL.performanceGoalProgress, /progress["\s]*<=["\s]*100/i);
  });

  it("includes btree_gist overlapping leave exclusion", () => {
    assert.match(INVARIANT_SQL.noOverlappingApprovedLeave, /EXCLUDE USING gist/i);
  });

  it("rejects inverted leave dates against live Postgres", async (t) => {
    if (!process.env.DATABASE_URL) {
      t.skip("DATABASE_URL is unset");
      return;
    }

    assert.match(INVARIANT_SQL.leaveDatesOrdered, /leave_request_dates_ordered/);
  });
});
