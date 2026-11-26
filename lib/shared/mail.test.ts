import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSmtpPassword, skippedMailDomain } from "./mail";

describe("normalizeSmtpPassword", () => {
  it("strips spaces from Gmail app-password display format", () => {
    assert.equal(normalizeSmtpPassword("abcd efgh ijkl mnop"), "abcdefghijklmnop");
  });

  it("trims surrounding whitespace", () => {
    assert.equal(normalizeSmtpPassword("  abcd1234efgh5678  "), "abcd1234efgh5678");
  });
});

describe("skippedMailDomain", () => {
  it("skips the seeded demo domain by default", () => {
    assert.equal(skippedMailDomain("John.Cena@Company.com", undefined), "company.com");
  });

  it("allows real domains", () => {
    assert.equal(skippedMailDomain("someone@gmail.com", undefined), null);
  });

  it("honours an explicit list and an empty override", () => {
    assert.equal(skippedMailDomain("a@test.dev", "example.com, test.dev"), "test.dev");
    assert.equal(skippedMailDomain("a@company.com", ""), null);
  });
});
