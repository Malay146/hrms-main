const RETRY = "The service is temporarily unavailable. Please retry in a moment.";
const CONFLICT = "That record already exists.";
const LEAVE_OVERLAP = "Those dates overlap an approved leave.";

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function sqlStateOf(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const obj = error as { code?: unknown; meta?: unknown; cause?: unknown };
  if (obj.code === "23P01") return "23P01";
  if (obj.meta && typeof obj.meta === "object" && obj.meta !== null) {
    const meta = obj.meta as { code?: unknown };
    if (meta.code === "23P01") return "23P01";
    const nested = sqlStateOf(meta);
    if (nested) return nested;
  }
  return sqlStateOf(obj.cause);
}

export function isRetryableInfrastructureError(error: unknown): boolean {
  const code = codeOf(error);
  if (code === "P2024" || code === "P2028" || code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ECONNRESET") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /timeout|ECONNREFUSED|connection pool|Can't reach database/i.test(message);
}

function isInternalInfrastructureMessage(message: string): boolean {
  return /prisma\.|Invalid `prisma|PrismaClient|connection pool|Can't reach database/i.test(message);
}

export function publicActionError(error: unknown, fallback: string): string {
  const code = codeOf(error);
  if (code === "P2002") return CONFLICT;
  if (sqlStateOf(error) === "23P01") return LEAVE_OVERLAP;
  const message = error instanceof Error ? error.message : "";
  if (code === "P2010" && /exclusion/i.test(message)) return LEAVE_OVERLAP;
  if (isRetryableInfrastructureError(error)) return RETRY;
  if (error instanceof Error && error.message && !isInternalInfrastructureMessage(error.message)) {
    return error.message;
  }
  return fallback;
}
