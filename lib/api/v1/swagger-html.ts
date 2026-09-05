import { AuthError, ForbiddenError } from "@/lib/auth/session";
import { requireStaffSession } from "@/lib/api/v1/http";

export function swaggerHtml(specUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PeoplePay360 API</title>
  <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  <style>
    html, body { margin: 0; padding: 0; background: #fafafa; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 24px 0 12px; }
    .swagger-ui .info .title { font-family: inherit; color: #18181b; }
    .swagger-ui .btn.authorize { background: #18181b; border-color: #18181b; color: #fff; }
    .swagger-ui .btn.execute { background: #18181b; border-color: #18181b; }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #3f3f46; }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #18181b; }
    .swagger-ui .opblock.opblock-put .opblock-summary-method,
    .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #52525b; }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #dc2626; }
    .swagger-ui .scheme-container { background: #fff; box-shadow: none; border-bottom: 1px solid #e4e4e7; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
  <script src="/api/docs/assets/swagger-ui-standalone-preset.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      dom_id: "#swagger-ui",
      deepLinking: true,
      filter: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "list",
      defaultModelsExpandDepth: 0,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      withCredentials: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      plugins: [SwaggerUIBundle.plugins.DownloadUrl],
      layout: "StandaloneLayout",
      requestInterceptor: function (req) {
        req.credentials = "include";
        return req;
      }
    });
  </script>
</body>
</html>`;
}

export async function requireDocsHtml() {
  try {
    await requireStaffSession();
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response("Sign in as staff to view API docs.", { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return new Response(error.message, { status: 403 });
    }
    return new Response("Could not open API docs.", { status: 500 });
  }
}
