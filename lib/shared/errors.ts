const RETRY = "The service is temporarily unavailable. Please retry in a moment.";
const CONFLICT = "That record already exists.";

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function isRetryableInfrastructureError(error: unknown): boolean {
  const code = codeOf(error);
  if (code === "P2024" || code === "P2028" || code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ECONNRESET") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /timeout|ECONNREFUSED|connection pool|Can't reach database/i.test(message);
}

export function publicActionError(error: unknown, fallback: string): string {
  const code = codeOf(error);
  if (code === "P2002") return CONFLICT;
  if (isRetryableInfrastructureError(error)) return RETRY;
  return fallback;
}
