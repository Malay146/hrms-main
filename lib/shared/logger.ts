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
