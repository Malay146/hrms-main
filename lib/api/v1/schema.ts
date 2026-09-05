import { z } from "zod";

export function toOpenApiSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    unrepresentable: "any",
    io: "input",
  }) as Record<string, unknown>;
  delete json.$schema;
  delete json.id;
  return json;
}

export const idParam = z.object({ id: z.string().min(1) });
export const employeeIdParam = z.object({ employeeId: z.string().min(1) });
export const emptyObject = z.object({});
