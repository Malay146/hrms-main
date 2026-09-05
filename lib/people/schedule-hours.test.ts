import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysPerWeek, lineHours, weeklyHours } from "./schedule-hours";

describe("working schedule math", () => {
  it("derives line hours from start, end, and break", () => {
    assert.equal(lineHours(9 * 60, 18 * 60, 60), 8);
  });

  it("sums weekly hours and unique days", () => {
    const lines = [
      { weekday: 1, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 2, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 3, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 4, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 5, startMin: 540, endMin: 1080, breakMin: 60 },
    ];
    assert.equal(weeklyHours(lines), 40);
    assert.equal(daysPerWeek(lines), 5);
  });
});
