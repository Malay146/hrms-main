import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicActionError } from "./errors";

describe("publicActionError", () => {
  it("maps unique violations to a conflict message", () => {
    const err = Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), {
      code: "P2002",
    });
    assert.equal(publicActionError(err, "Could not save."), "That record already exists.");
  });

  it("maps timeouts and connection failures to a retry message", () => {
    const timeout = Object.assign(new Error("Timed out fetching a new connection from the connection pool."), {
      code: "P2024",
    });
    assert.match(publicActionError(timeout, "Could not save."), /temporarily unavailable/i);

    const down = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    assert.match(publicActionError(down, "Could not save."), /temporarily unavailable/i);
  });

  it("does not return raw Prisma or pg messages", () => {
    const err = new Error('Invalid `prisma.user.findUnique()` invocation');
    assert.equal(publicActionError(err, "Could not save."), "Could not save.");
  });

  it("preserves safe domain error messages", () => {
    const err = new Error("Not enough remaining allocation balance.");
    assert.equal(publicActionError(err, "Could not save."), "Not enough remaining allocation balance.");
  });
});
