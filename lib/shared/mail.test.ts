import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSmtpPassword } from "./mail";

describe("normalizeSmtpPassword", () => {
  it("strips spaces from Gmail app-password display format", () => {
    assert.equal(normalizeSmtpPassword("abcd efgh ijkl mnop"), "abcdefghijklmnop");
  });

  it("trims surrounding whitespace", () => {
    assert.equal(normalizeSmtpPassword("  abcd1234efgh5678  "), "abcd1234efgh5678");
  });
});
