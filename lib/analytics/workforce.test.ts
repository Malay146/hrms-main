import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSkillGaps,
  classifyWorkforceReportQuestion,
  isValidAnalyticsDateRange,
  isValidProficiency,
  summarizeAttendance,
  summarizeGoals,
  workforceVisibleEmployeeIds,
} from "./workforce";

test("skill gaps are case-insensitive, bounded below zero, and sorted by size", () => {
  assert.deepEqual(
    calculateSkillGaps(
      [
        { skillName: "React", targetLevel: 4 },
        { skillName: "TypeScript", targetLevel: 2 },
        { skillName: "Testing", targetLevel: 3 },
      ],
      [
        { name: "react", proficiency: 2 },
        { name: "TypeScript", proficiency: 5 },
      ],
    ),
    [
      { skillName: "React", currentLevel: 2, targetLevel: 4, gap: 2 },
      { skillName: "Testing", currentLevel: 0, targetLevel: 3, gap: 3 },
    ].sort((left, right) => right.gap - left.gap),
  );
});

test("attendance and goal summaries do not count leave days as absences", () => {
  assert.deepEqual(summarizeAttendance(["present", "half_day", "absent", "leave"]), {
    recordedDays: 4,
    attendedDays: 2,
    absentDays: 1,
    attendancePct: 67,
  });
  assert.deepEqual(summarizeGoals([100, 50, 0]), {
    total: 3,
    completed: 1,
    completionPct: 33,
  });
  assert.deepEqual(summarizeGoals([]), { total: 0, completed: 0, completionPct: null });
});

test("report date ranges reject invalid, reversed, and overlong ranges", () => {
  assert.equal(isValidAnalyticsDateRange("2026-01-01", "2026-01-31"), true);
  assert.equal(isValidAnalyticsDateRange("2026-02-01", "2026-01-01"), false);
  assert.equal(isValidAnalyticsDateRange("2026-01-01", "2027-01-02"), false);
  assert.equal(isValidAnalyticsDateRange("2026-02-31", "2026-03-01"), false);
  assert.equal(isValidAnalyticsDateRange("not-a-date", "2026-01-01"), false);
});

test("proficiency values are limited to the five-point scale", () => {
  assert.equal(isValidProficiency(1), true);
  assert.equal(isValidProficiency(5), true);
  assert.equal(isValidProficiency(0), false);
  assert.equal(isValidProficiency(2.5), false);
});

test("workforce visibility is limited to self and direct reports outside HR", () => {
  assert.deepEqual(workforceVisibleEmployeeIds(false, "self", ["direct-a", "direct-b"]), [
    "self",
    "direct-a",
    "direct-b",
  ]);
  assert.deepEqual(workforceVisibleEmployeeIds(false, "self", ["self", "direct-a"]), [
    "self",
    "direct-a",
  ]);
  assert.equal(workforceVisibleEmployeeIds(true, "hr-user", ["direct-a"]), undefined);
});

test("report classification covers the supported templates and rejects turnover", () => {
  assert.equal(classifyWorkforceReportQuestion("department attendance this month"), "attendance");
  assert.equal(classifyWorkforceReportQuestion("leave utilization last quarter"), "leave");
  assert.equal(classifyWorkforceReportQuestion("compare performance across departments"), "performance");
  assert.equal(classifyWorkforceReportQuestion("show department skill gaps"), "skill_gap");
  assert.equal(classifyWorkforceReportQuestion("which department has the highest turnover"), "unsupported");
});
