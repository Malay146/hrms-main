import { requireDocsHtml, swaggerHtml } from "@/lib/api/v1/swagger-html";

export async function GET() {
  const denied = await requireDocsHtml();
  if (denied) return denied;
  return new Response(swaggerHtml("/api/v1/openapi.json"), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
