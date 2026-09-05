import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payslipWarning } from "./warnings";

describe("payslipWarning", () => {
  it("flags a missing period contract first", () => {
    assert.equal(
      payslipWarning({
        bankAccount: null,
        hasContract: false,
        duplicateInOtherPayrun: true,
      }),
      "No contract for this period",
    );
  });

  it("flags missing bank details", () => {
    assert.equal(
      payslipWarning({
        bankAccount: "  ",
        hasContract: true,
        duplicateInOtherPayrun: false,
      }),
      "A/C missing",
    );
  });

  it("flags a duplicate payslip", () => {
    assert.equal(
      payslipWarning({
        bankAccount: "1234567890",
        hasContract: true,
        duplicateInOtherPayrun: true,
      }),
      "Duplicate",
    );
  });

  it("returns null when the row is clean", () => {
    assert.equal(
      payslipWarning({
        bankAccount: "1234567890",
        hasContract: true,
        duplicateInOtherPayrun: false,
      }),
      null,
    );
  });
});
