import { NextResponse } from "next/server";

/** Old docs URL — send people to the standalone Swagger page. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/swagger-ui", request.url), 308);
}
