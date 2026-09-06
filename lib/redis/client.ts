/**
 * Optional Redis connection for shared rate-limit counters.
 * Sessions, jobs, and dashboard cache stay in Postgres / Next.js cache.
 */
import { createClient, type RedisClientType } from "redis";
import { logger } from "@/lib/shared/logger";

const globalForRedis = globalThis as unknown as {
  redis?: RedisClientType | null;
  redisUrl?: string;
};

export function redisUrl() {
  return process.env.REDIS_URL?.trim() || "";
}

export async function getRedis(): Promise<RedisClientType | null> {
  const url = redisUrl();
  if (!url) return null;

  if (globalForRedis.redis && globalForRedis.redisUrl === url) {
    if (!globalForRedis.redis.isOpen) {
      try {
        await globalForRedis.redis.connect();
      } catch (error) {
        logger.warn("redis.connect_failed", { reason: error instanceof Error ? error.message : "unknown" });
        globalForRedis.redis = null;
        return null;
      }
    }
    return globalForRedis.redis;
  }

  const client = createClient({ url });
  client.on("error", (error) => {
    logger.warn("redis.error", { reason: error instanceof Error ? error.message : "unknown" });
  });

  try {
    await client.connect();
    globalForRedis.redis = client;
    globalForRedis.redisUrl = url;
    logger.info("redis.connected", {});
    return client;
  } catch (error) {
    logger.warn("redis.connect_failed", { reason: error instanceof Error ? error.message : "unknown" });
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
    globalForRedis.redis = null;
    globalForRedis.redisUrl = url;
    return null;
  }
}
