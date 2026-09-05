import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canSubmitRequest,
  remaining,
  takenAfterApproval,
} from "./time-off-balance";

describe("time off balance", () => {
  it("computes remaining balance", () => {
    assert.equal(remaining(20, 3.5), 16.5);
  });

  it("blocks requests without an approved allocation when required", () => {
    assert.match(
      canSubmitRequest({
        requiresAllocation: true,
        remaining: 10,
        duration: 2,
        allocationStatus: "draft",
      }) ?? "",
      /approved allocation/i,
    );
  });

  it("blocks over-balance requests", () => {
    assert.match(
      canSubmitRequest({
        requiresAllocation: true,
        remaining: 1,
        duration: 2,
        allocationStatus: "approved",
      }) ?? "",
      /remaining balance/i,
    );
  });

  it("increments taken on approval", () => {
    assert.equal(takenAfterApproval(2, 1.5), 3.5);
  });

  it("allows unpaid-style types without allocation", () => {
    assert.equal(
      canSubmitRequest({
        requiresAllocation: false,
        remaining: 0,
        duration: 3,
        allocationStatus: "draft",
      }),
      null,
    );
  });
});
