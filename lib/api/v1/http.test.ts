import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RATE_LIMIT_MESSAGE } from "../../shared/rate-limit";
import { statusForActionError } from "./action-status";

describe("statusForActionError", () => {
  it("maps rate-limit copy to 429", () => {
    assert.equal(statusForActionError(RATE_LIMIT_MESSAGE), 429);
  });

  it("keeps auth and not-found statuses", () => {
    assert.equal(statusForActionError("Please sign in to continue."), 401);
    assert.equal(statusForActionError("Employee not found."), 404);
  });
});
