import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeOvertime,
  computeWorkedHours,
  deriveAttendanceMetrics,
  isLateAgainstSchedule,
  isMissingCheckout,
  weekdayFromDateKey,
} from "./attendance-metrics";

const weekdayLines = [
  { weekday: 1, startMin: 9 * 60, endMin: 18 * 60, breakMin: 60 },
  { weekday: 2, startMin: 9 * 60, endMin: 18 * 60, breakMin: 60 },
  { weekday: 3, startMin: 9 * 60, endMin: 18 * 60, breakMin: 60 },
  { weekday: 4, startMin: 9 * 60, endMin: 18 * 60, breakMin: 60 },
  { weekday: 5, startMin: 9 * 60, endMin: 18 * 60, breakMin: 60 },
];

describe("attendance metrics", () => {
  it("maps ISO weekday Mon=1 … Sun=7", () => {
    assert.equal(weekdayFromDateKey("2026-09-07"), 1); // Monday
    assert.equal(weekdayFromDateKey("2026-09-13"), 7); // Sunday
  });

  it("computes worked hours minus break", () => {
    const checkIn = new Date("2026-09-07T03:30:00.000Z"); // 09:00 IST
    const checkOut = new Date("2026-09-07T12:30:00.000Z"); // 18:00 IST
    assert.equal(computeWorkedHours({ checkIn, checkOut, breakMin: 60 }), 8);
  });

  it("flags late against schedule start", () => {
    const checkIn = new Date("2026-09-07T04:00:00.000Z"); // 09:30 IST
    assert.equal(
      isLateAgainstSchedule({
        checkIn,
        line: weekdayLines[0],
        graceMin: 0,
      }),
      true,
    );
  });

  it("detects missing checkout on past dates", () => {
    assert.equal(
      isMissingCheckout({
        checkIn: new Date(),
        checkOut: null,
        dateKey: "2026-09-01",
        todayKey: "2026-09-07",
      }),
      true,
    );
  });

  it("derives overtime from schedule expected hours", () => {
    const checkIn = new Date("2026-09-07T03:30:00.000Z");
    const checkOut = new Date("2026-09-07T13:30:00.000Z"); // 19:00 IST → 9h - 1h break = 8? 
    // 03:30 to 13:30 = 10h raw - 60m = 9h worked; expected 8 → OT 1
    const metrics = deriveAttendanceMetrics({
      checkIn,
      checkOut,
      dateKey: "2026-09-07",
      todayKey: "2026-09-07",
      scheduleLines: weekdayLines,
    });
    assert.equal(metrics.workedHours, 9);
    assert.equal(metrics.expectedHours, 8);
    assert.equal(computeOvertime(metrics.workedHours, metrics.expectedHours), 1);
  });
});
