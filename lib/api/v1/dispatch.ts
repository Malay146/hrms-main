import { z } from "zod";
import { firstZodError } from "@/lib/shared/validations";
import { findApiOperation } from "@/lib/api/v1/operations";
import { actionToResponse, errorToResponse, jsonResponse, requestIdFrom } from "@/lib/api/v1/http";
import { runWithRequestId } from "@/lib/shared/request-context";
import { enforceRateLimits, ipRateKey, RATE_LIMITS, RATE_LIMIT_MESSAGE } from "@/lib/shared/rate-limit";
import { ipFromHeaders } from "@/lib/shared/request-ip";

function parseQuery(url: URL, schema?: z.ZodType) {
  if (!schema) return {};
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: firstZodError(parsed.error) };
  }
  return { data: parsed.data as Record<string, unknown> };
}

export async function dispatchV1(request: Request, slug: string[]) {
  const requestId = requestIdFrom(request);
  return runWithRequestId(requestId, () => dispatchInner(request, slug, requestId));
}

async function dispatchInner(request: Request, slug: string[], requestId: string) {
  const pathname = `/${slug.join("/")}`;
  const found = findApiOperation(request.method, pathname);
  if (!found) {
    return jsonResponse({ ok: false, error: "Unknown API operation." }, 404, requestId);
  }

  try {
    const { operation, params } = found;
    if (pathname !== "/health") {
      const limited = await enforceRateLimits([
        { key: ipRateKey("api", ipFromHeaders(request.headers)), ...RATE_LIMITS.apiIp },
      ]);
      if (limited) {
        return jsonResponse({ ok: false, error: RATE_LIMIT_MESSAGE }, 429, requestId);
      }
    }
    if (operation.params) {
      const parsedParams = operation.params.safeParse(params);
      if (!parsedParams.success) {
        return jsonResponse({ ok: false, error: firstZodError(parsedParams.error) }, 400, requestId);
      }
    }

    const queryResult = parseQuery(new URL(request.url), operation.query);
    if ("error" in queryResult && queryResult.error) {
      return jsonResponse({ ok: false, error: queryResult.error }, 400, requestId);
    }

    let body: unknown = undefined;
    if (operation.body && request.method !== "GET" && request.method !== "HEAD") {
      const text = await request.text();
      const json = text ? JSON.parse(text) : {};
      const parsedBody = operation.body.safeParse(json);
      if (!parsedBody.success) {
        return jsonResponse({ ok: false, error: firstZodError(parsedBody.error) }, 400, requestId);
      }
      body = parsedBody.data;
    }

    const result = await operation.handler({
      params,
      query: ("data" in queryResult ? queryResult.data : {}) ?? {},
      body,
      request,
    });
    return actionToResponse(result, request.method, requestId);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse({ ok: false, error: "Request body must be JSON." }, 400, requestId);
    }
    return errorToResponse(error, requestId);
  }
}
