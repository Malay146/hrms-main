import { getRequestId } from "./request-context";

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
  const requestId = getRequestId();
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
    ...(requestId ? { requestId } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(event: string, meta?: Record<string, unknown>) {
    write("info", event, meta);
  },
  warn(event: string, meta?: Record<string, unknown>) {
    write("warn", event, meta);
  },
  error(event: string, meta?: Record<string, unknown>) {
    write("error", event, meta);
  },
};

/** Structured timing for hot list/dashboard actions (Scale-to-5k S0). */
export async function withTiming<T>(
  event: string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {},
): Promise<T> {
  const started = performance.now();
  try {
    const result = await fn();
    logger.info(event, {
      ...meta,
      ok: true,
      ms: Math.round(performance.now() - started),
    });
    return result;
  } catch (error) {
    logger.error(event, {
      ...meta,
      ok: false,
      ms: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
