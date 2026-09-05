import { jsonResponse, requestIdFrom } from "@/lib/api/v1/http";

export async function GET(request: Request) {
  return jsonResponse(
    {
      ok: true,
      data: {
        name: "PeoplePay360 HRMS API",
        version: "1.0.0",
        docs: "/swagger-ui",
        swagger: "/swagger-ui",
        openapi: "/api/v1/openapi.json",
        health: "/api/v1/health",
      },
    },
    200,
    requestIdFrom(request),
  );
}
