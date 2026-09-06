import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeRateLimit,
  createMemoryRateLimitStore,
  enforceRateLimits,
  hashedRateKey,
  RATE_LIMIT_MESSAGE,
} from "./rate-limit";

describe("rate limit (memory store)", () => {
  it("allows requests under the limit and blocks the next", async () => {
    const store = createMemoryRateLimitStore();
    assert.equal(await consumeRateLimit("t:a", 2, 60_000, store), true);
    assert.equal(await consumeRateLimit("t:a", 2, 60_000, store), true);
    assert.equal(await consumeRateLimit("t:a", 2, 60_000, store), false);
  });

  it("keeps buckets independent per key", async () => {
    const store = createMemoryRateLimitStore();
    assert.equal(await consumeRateLimit("t:one", 1, 60_000, store), true);
    assert.equal(await consumeRateLimit("t:two", 1, 60_000, store), true);
    assert.equal(await consumeRateLimit("t:one", 1, 60_000, store), false);
  });

  it("resets after the window", async () => {
    let now = 1_000_000;
    const store = createMemoryRateLimitStore(() => now);
    assert.equal(await consumeRateLimit("t:w", 1, 1_000, store), true);
    assert.equal(await consumeRateLimit("t:w", 1, 1_000, store), false);
    now += 1_001;
    assert.equal(await consumeRateLimit("t:w", 1, 1_000, store), true);
  });

  it("returns the public error from enforceRateLimits", async () => {
    const store = createMemoryRateLimitStore();
    const first = await enforceRateLimits([{ key: "t:e", limit: 1, windowMs: 60_000 }], store);
    const second = await enforceRateLimits([{ key: "t:e", limit: 1, windowMs: 60_000 }], store);
    assert.equal(first, null);
    assert.equal(second, RATE_LIMIT_MESSAGE);
  });

  it("fails open when the store throws", async () => {
    const store = {
      async increment() {
        throw new Error("redis down");
      },
    };
    assert.equal(await consumeRateLimit("t:fail", 1, 60_000, store), true);
  });

  it("hashes email subjects without keeping the raw address in the key", () => {
    const key = hashedRateKey("signin:email", "Admin@Oddo.com");
    assert.equal(key, hashedRateKey("signin:email", "admin@oddo.com"));
    assert.doesNotMatch(key, /oddo\.com/i);
  });
});
