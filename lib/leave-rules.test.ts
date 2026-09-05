import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  datesOverlap,
  findOverlappingLeave,
  paidLeaveDays,
  validateLeaveDates,
} from "./leave-rules";
import { nextEmployeeId, orgSlugFromName } from "./employee-id";

describe("leave rules", () => {
  it("detects overlapping date ranges", () => {
    assert.equal(datesOverlap("2026-09-10", "2026-09-12", "2026-09-12", "2026-09-14"), true);
    assert.equal(datesOverlap("2026-09-10", "2026-09-11", "2026-09-12", "2026-09-14"), false);
  });

  it("ignores rejected leave when checking overlap", () => {
    const overlap = findOverlappingLeave("2026-09-10", "2026-09-12", [
      { startDate: "2026-09-11", endDate: "2026-09-13", status: "rejected" },
    ]);
    assert.equal(overlap, undefined);
  });

  it("blocks past paid leave and allows sick leave today", () => {
    assert.match(
      validateLeaveDates({
        type: "paid",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        todayKey: "2026-09-05",
      }) ?? "",
      /past/,
    );
    assert.equal(
      validateLeaveDates({
        type: "sick",
        startDate: "2026-09-05",
        endDate: "2026-09-05",
        todayKey: "2026-09-05",
      }),
      null,
    );
  });

  it("deducts paid leave days only for paid type", () => {
    assert.equal(paidLeaveDays("paid", "2026-09-10", "2026-09-12"), 3);
    assert.equal(paidLeaveDays("sick", "2026-09-10", "2026-09-12"), 0);
  });
});

describe("employee ids", () => {
  it("builds the next ORG-YYYY-NNN id", () => {
    assert.equal(orgSlugFromName("Acme Inc."), "ACME");
    assert.equal(
      nextEmployeeId("ACME", 2026, ["ACME-2026-001", "ACME-2026-007"]),
      "ACME-2026-008",
    );
  });
});
