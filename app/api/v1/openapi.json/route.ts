import { buildOpenApiDocument } from "@/lib/api/v1/openapi";
import { errorToResponse, jsonResponse, requestIdFrom, requireStaffSession } from "@/lib/api/v1/http";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    await requireStaffSession();
    return jsonResponse(buildOpenApiDocument(), 200, requestId);
  } catch (error) {
    return errorToResponse(error, requestId);
  }
}
