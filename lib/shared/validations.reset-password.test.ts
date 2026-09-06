import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./validations";

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    const parsed = forgotPasswordSchema.safeParse({ email: "admin@oddo.com" });
    assert.equal(parsed.success, true);
  });

  it("rejects an invalid email", () => {
    const parsed = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    assert.equal(parsed.success, false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching strong passwords with a token", () => {
    const parsed = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "NewPass12",
      confirmPassword: "NewPass12",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects mismatched passwords", () => {
    const parsed = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "NewPass12",
      confirmPassword: "OtherPass12",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects passwords without a number", () => {
    const parsed = resetPasswordSchema.safeParse({
      token: "abc123",
      newPassword: "NewPassword",
      confirmPassword: "NewPassword",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects a missing token", () => {
    const parsed = resetPasswordSchema.safeParse({
      token: "",
      newPassword: "NewPass12",
      confirmPassword: "NewPass12",
    });
    assert.equal(parsed.success, false);
  });
});
