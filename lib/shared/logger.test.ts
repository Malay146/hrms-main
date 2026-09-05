import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runWithRequestId, getRequestId } from "./request-context";

describe("request context", () => {
  it("returns undefined outside a store", () => {
    assert.equal(getRequestId(), undefined);
  });

  it("exposes the id inside runWithRequestId", async () => {
    await runWithRequestId("req_test", async () => {
      assert.equal(getRequestId(), "req_test");
    });
  });
});
