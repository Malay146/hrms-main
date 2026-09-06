import { randomUUID } from "node:crypto";
import { AuthError, ForbiddenError, getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/permissions";
import type { ActionResult } from "@/lib/shared/types";
import { statusForActionError } from "@/lib/api/v1/action-status";

export { statusForActionError };

export function requestIdFrom(request: Request) {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export function jsonResponse(body: unknown, status: number, requestId: string) {
  return Response.json(body, {
    status,
    headers: {
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
    },
  });
}

export function actionToResponse(
  result: ActionResult<unknown> | Record<string, unknown>,
  method: string,
  requestId: string,
) {
  if (result && typeof result === "object" && "ok" in result) {
    const envelope = result as ActionResult<unknown>;
    if (!envelope.ok) {
      return jsonResponse({ ok: false, error: envelope.error }, statusForActionError(envelope.error), requestId);
    }
    const status = method === "POST" ? 201 : method === "DELETE" ? 200 : 200;
    return jsonResponse({ ok: true, data: envelope.data ?? null }, status, requestId);
  }
  return jsonResponse(result, 200, requestId);
}

export async function requireStaffSession() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  if (!isStaffRole(user.role)) throw new ForbiddenError("API documentation is available to staff accounts.");
  return user;
}

export function errorToResponse(error: unknown, requestId: string) {
  if (error instanceof AuthError) {
    return jsonResponse({ ok: false, error: error.message }, 401, requestId);
  }
  if (error instanceof ForbiddenError) {
    return jsonResponse({ ok: false, error: error.message }, 403, requestId);
  }
  return jsonResponse({ ok: false, error: "Unexpected server error." }, 500, requestId);
}
