import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextSequentialCode } from "./codes";

describe("nextSequentialCode", () => {
  it("starts at 001", () => {
    assert.equal(nextSequentialCode("CAN", []), "CAN001");
  });

  it("follows the highest code, not the count", () => {
    assert.equal(nextSequentialCode("CAN", ["CAN001", "CAN007", "CAN003"]), "CAN008");
  });

  it("ignores other prefixes and malformed codes", () => {
    assert.equal(nextSequentialCode("JOB", ["CAN050", "JOB002", "JOBX"]), "JOB003");
  });

  it("grows past the padding width", () => {
    assert.equal(nextSequentialCode("CAN", ["CAN999"]), "CAN1000");
  });
});
