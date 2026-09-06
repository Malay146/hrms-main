import { createHash } from "node:crypto";
import { getRedis } from "@/lib/redis/client";
import { logger } from "@/lib/shared/logger";

/** Shared with HTTP 429 mapping in `statusForActionError`. */
export const RATE_LIMIT_MESSAGE = "Too many requests. Try again shortly.";

export const RATE_WINDOWS = {
  minute: 60_000,
  tenMinutes: 10 * 60_000,
  fifteenMinutes: 15 * 60_000,
  hour: 60 * 60_000,
} as const;

export const RATE_LIMITS = {
  signInIp: { limit: 10, windowMs: RATE_WINDOWS.tenMinutes },
  signInEmail: { limit: 10, windowMs: RATE_WINDOWS.tenMinutes },
  signUpIp: { limit: 5, windowMs: RATE_WINDOWS.hour },
  passwordResetIp: { limit: 5, windowMs: RATE_WINDOWS.hour },
  passwordResetEmail: { limit: 3, windowMs: RATE_WINDOWS.hour },
  passwordResetCompleteIp: { limit: 20, windowMs: RATE_WINDOWS.fifteenMinutes },
  copilotUser: { limit: 30, windowMs: RATE_WINDOWS.tenMinutes },
  apiIp: { limit: 120, windowMs: RATE_WINDOWS.minute },
} as const;

export type RateLimitStore = {
  increment(key: string, windowMs: number): Promise<number>;
};

export function createMemoryRateLimitStore(now: () => number = Date.now): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async increment(key, windowMs) {
      const at = now();
      const current = buckets.get(key);
      if (!current || current.resetAt <= at) {
        buckets.set(key, { count: 1, resetAt: at + windowMs });
        return 1;
      }
      current.count += 1;
      return current.count;
    },
  };
}

const memoryStore = createMemoryRateLimitStore();

export function ipRateKey(bucket: string, ip: string) {
  return `rl:${bucket}:ip:${ip}`;
}

export function hashedRateKey(bucket: string, value: string) {
  const digest = createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 24);
  return `rl:${bucket}:${digest}`;
}

export function userRateKey(bucket: string, userId: string) {
  return `rl:${bucket}:user:${userId}`;
}

async function redisStore(): Promise<RateLimitStore | null> {
  const client = await getRedis();
  if (!client) return null;
  return {
    async increment(key, windowMs) {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, Math.max(1, Math.ceil(windowMs / 1000)));
      }
      return count;
    },
  };
}

async function activeStore(): Promise<RateLimitStore> {
  try {
    return (await redisStore()) ?? memoryStore;
  } catch (error) {
    logger.warn("rate_limit.redis_fallback", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return memoryStore;
  }
}

/**
 * Returns true when the request is allowed.
 * Redis is optional: without REDIS_URL this is per-process memory.
 * Store failures fail open so login cannot be taken down by Redis.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  store?: RateLimitStore,
): Promise<boolean> {
  try {
    const used = store ?? (await activeStore());
    const count = await used.increment(key, windowMs);
    return count <= limit;
  } catch (error) {
    logger.warn("rate_limit.fail_open", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    if (store) return true;
    try {
      const count = await memoryStore.increment(key, windowMs);
      return count <= limit;
    } catch {
      return true;
    }
  }
}

export async function enforceRateLimits(
  checks: { key: string; limit: number; windowMs: number }[],
  store?: RateLimitStore,
): Promise<string | null> {
  for (const check of checks) {
    const allowed = await consumeRateLimit(check.key, check.limit, check.windowMs, store);
    if (!allowed) return RATE_LIMIT_MESSAGE;
  }
  return null;
}
