import type { z } from "zod";
import type { ActionResult } from "@/lib/shared/types";

export type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

export type ApiContext<P = Record<string, string>, Q = Record<string, unknown>, B = unknown> = {
  params: P;
  query: Q;
  body: B;
  request: Request;
};

export type ApiOperation = {
  method: HttpMethod;
  path: string;
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  public?: boolean;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  handler: (ctx: ApiContext) => Promise<ActionResult<unknown> | Record<string, unknown>>;
};

export function defineOp(operation: ApiOperation): ApiOperation {
  return operation;
}
