import path from "node:path";
import { readFile } from "node:fs/promises";
import { requireDocsHtml } from "@/lib/api/v1/swagger-html";

const DIST = path.join(process.cwd(), "node_modules", "swagger-ui-dist");

const ALLOWED: Record<string, string> = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "application/javascript; charset=utf-8",
  "swagger-ui-standalone-preset.js": "application/javascript; charset=utf-8",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const denied = await requireDocsHtml();
  if (denied) return denied;
  const { file } = await context.params;
  const type = ALLOWED[file];
  if (!type) return new Response("Not found", { status: 404 });
  const bytes = await readFile(path.join(DIST, file));
  return new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
