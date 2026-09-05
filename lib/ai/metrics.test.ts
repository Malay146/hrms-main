import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceRate,
  departmentAttendance,
  flightRiskScore,
  lateRate,
  leaveClashCount,
  payrollOutlierFlags,
  weekdayCount,
  workforceHealthScore,
} from "./metrics";

describe("attendanceRate", () => {
  it("counts present and half_day against expected days", () => {
    const rate = attendanceRate({
      expectedDays: 10,
      presentDays: 8,
      halfDays: 2,
      absentDays: 0,
    });
    assert.equal(rate, 90);
  });

  it("returns 0 when expectedDays is 0", () => {
    assert.equal(
      attendanceRate({ expectedDays: 0, presentDays: 0, halfDays: 0, absentDays: 0 }),
      0,
    );
  });
});

describe("leaveClashCount", () => {
  it("counts overlapping ranges in the same department", () => {
    const n = leaveClashCount([
      { department: "Engineering", start: "2026-09-10", end: "2026-09-12" },
      { department: "Engineering", start: "2026-09-12", end: "2026-09-14" },
      { department: "HR", start: "2026-09-12", end: "2026-09-14" },
    ]);
    assert.equal(n, 1);
  });
});

describe("flightRiskScore", () => {
  it("scores higher when attendance drops and sick leave rises", () => {
    const low = flightRiskScore({
      attendanceDeltaPct: 0,
      sickLeaveDays30: 0,
      unpaidLeaveDays30: 0,
      paidBalance: 12,
      tenureDays: 400,
    });
    const high = flightRiskScore({
      attendanceDeltaPct: -25,
      sickLeaveDays30: 6,
      unpaidLeaveDays30: 2,
      paidBalance: 18,
      tenureDays: 40,
    });
    assert.equal(low < high, true);
    assert.equal(high <= 100, true);
  });
});

describe("workforceHealthScore", () => {
  it("bands a strong org as healthy", () => {
    const result = workforceHealthScore({
      attendancePct: 96,
      pendingLeavePerEmployee: 0.05,
      inactivePct: 0,
      payrunWarningPct: 0,
    });
    assert.equal(result.band, "healthy");
    assert.equal(result.score >= 80, true);
  });
});

describe("lateRate", () => {
  it("returns percent of rows marked late", () => {
    assert.equal(lateRate([true, false, true, false]), 50);
    assert.equal(lateRate([]), 0);
  });
});

describe("departmentAttendance", () => {
  it("rolls up attendance percent by department", () => {
    const rows = departmentAttendance([
      { department: "Engineering", expectedDays: 10, presentDays: 8, halfDays: 0, absentDays: 2 },
      { department: "Engineering", expectedDays: 10, presentDays: 10, halfDays: 0, absentDays: 0 },
      { department: "HR", expectedDays: 10, presentDays: 5, halfDays: 0, absentDays: 5 },
    ]);
    const eng = rows.find((row) => row.name === "Engineering");
    const hr = rows.find((row) => row.name === "HR");
    assert.equal(eng?.headcount, 2);
    assert.equal(eng?.attendancePct, 90);
    assert.equal(hr?.attendancePct, 50);
  });
});

describe("payrollOutlierFlags", () => {
  it("flags nets more than two standard deviations from the mean", () => {
    const flags = payrollOutlierFlags([50, 52, 48, 51, 49, 120]);
    assert.deepEqual(flags, [false, false, false, false, false, true]);
  });
});

describe("weekdayCount", () => {
  it("counts Mon-Fri inclusive", () => {
    assert.equal(weekdayCount("2026-09-07", "2026-09-11"), 5);
    assert.equal(weekdayCount("2026-09-12", "2026-09-13"), 0);
  });
});
