import { toOpenApiSchema } from "@/lib/api/v1/schema";
import { apiOperations } from "@/lib/api/v1/operations";
import { z } from "zod";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function operationToPathItem(operation: (typeof apiOperations)[number]) {
  const parameters: Record<string, unknown>[] = [];
  if (operation.params) {
    const schema = toOpenApiSchema(operation.params) as { properties?: Record<string, unknown>; required?: string[] };
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      parameters.push({
        name,
        in: "path",
        required: true,
        schema: property,
      });
    }
  }
  if (operation.query) {
    const schema = toOpenApiSchema(operation.query) as { properties?: Record<string, unknown>; required?: string[] };
    const required = new Set(schema.required ?? []);
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      parameters.push({
        name,
        in: "query",
        required: required.has(name),
        schema: property,
      });
    }
  }

  const item: Record<string, unknown> = {
    operationId: operation.operationId,
    summary: operation.summary,
    description: operation.description,
    tags: operation.tags,
    security: operation.public ? [] : [{ cookieAuth: [] }],
    parameters,
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SuccessEnvelope" },
          },
        },
      },
      "400": { description: "Validation or domain error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
      "401": { description: "Not signed in" },
      "403": { description: "Missing permission" },
      "404": { description: "Not found" },
    },
  };

  if (operation.body) {
    item.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: toOpenApiSchema(operation.body),
        },
      },
    };
  }

  return item;
}

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const operation of apiOperations) {
    const fullPath = `/api/v1${operation.path}`;
    paths[fullPath] ??= {};
    paths[fullPath][operation.method] = operationToPathItem(operation);
  }

  paths["/api/auth/sign-in/email"] = {
    post: {
      operationId: "signInEmail",
      tags: ["Account"],
      summary: "Sign in",
      description: "Better Auth email/password. Sets the session cookie used by Try it out.",
      security: [],
      requestBody: {
        required: true,
        content: { "application/json": { schema: toOpenApiSchema(loginBody) } },
      },
      responses: {
        "200": { description: "Signed in; session cookie is set." },
        "401": { description: "Invalid credentials" },
      },
    },
  };

  paths["/api/auth/sign-out"] = {
    post: {
      operationId: "signOut",
      tags: ["Account"],
      summary: "Sign out",
      responses: { "200": { description: "Session cleared" } },
    },
  };

  paths["/api/auth/get-session"] = {
    get: {
      operationId: "getSession",
      tags: ["Account"],
      summary: "Read the current Better Auth session",
      responses: { "200": { description: "Session or null" } },
    },
  };

  paths["/api/cron/payslips"] = {
    post: {
      operationId: "cronIssuePayslips",
      tags: ["Cron"],
      summary: "Month-end payslip cron",
      description: "Machine endpoint. Authorize with Bearer CRON_SECRET.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: "month",
          in: "query",
          schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
        },
      ],
      responses: {
        "200": { description: "Issue result" },
        "401": { description: "Missing or invalid cron secret" },
      },
    },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "PeoplePay360 HRMS API",
      version: "1.0.0",
      description:
        "Versioned HTTP API for the PeoplePay360 HRMS. Authenticated calls use the same Better Auth session cookie as the web app. Staff permissions still apply per operation — Try it out will return 403 when the signed-in role cannot perform that action. Wages and bank details are never exposed beyond payroll-permissioned routes.",
      contact: { name: "PeoplePay360" },
    },
    servers: [{ url: "/", description: "This environment" }],
    tags: [
      { name: "Meta", description: "Health and discovery" },
      { name: "Account", description: "Session, profile, password" },
      { name: "Dashboards", description: "Aggregated home screens" },
      { name: "Departments" },
      { name: "Employees" },
      { name: "Schedules" },
      { name: "Contracts" },
      { name: "Attendance" },
      { name: "Leave" },
      { name: "Payroll" },
      { name: "Performance" },
      { name: "Recruitment" },
      { name: "Notifications" },
      { name: "AI" },
      { name: "Cron", description: "Machine-to-machine jobs" },
    ],
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
          description: "Set automatically after POST /api/auth/sign-in/email in this browser.",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "CRON_SECRET for /api/cron/payslips only.",
        },
      },
      schemas: {
        SuccessEnvelope: {
          type: "object",
          required: ["ok"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            data: {},
          },
        },
        ErrorEnvelope: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", enum: [false] },
            error: { type: "string" },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  };
}
