import { aiModel, isAiConfigured } from "./provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { SQL_QUERY_RULES, SQL_SCHEMA_CATALOG } from "./sql-catalog";
import { guardSelectSql, isDeniedColumn, SQL_ALLOWED_TABLES, SQL_MAX_ROWS } from "./sql-guard";
import { scopeSqlToOrganization } from "./sql-scope";

const STATEMENT_TIMEOUT_MS = 5_000;

const model = aiModel;

// Every key must be required — OpenAI structured output rejects optional keys.
const querySchema = z.object({
  answerable: z.boolean(),
  sql: z.string().max(2_000).describe("The SELECT statement, or an empty string when answerable is false."),
});

/** Prisma raw rows carry Decimal and Date objects; flatten them for the model. */
function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.toNumber === "function") return (record.toNumber as () => number)();
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) next[key] = jsonSafe(item);
    return next;
  }
  return value;
}

/** Columns the copilot may read per table: everything except denied ones (wages, bank, address…). */
let readableColumnsCache: Promise<Record<string, string[]>> | null = null;
function readableColumns() {
  readableColumnsCache ??= prisma
    .$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [...SQL_ALLOWED_TABLES],
    )
    .then((rows) => {
      const map: Record<string, string[]> = {};
      for (const row of rows) {
        if (isDeniedColumn(row.column_name)) continue;
        (map[row.table_name] ??= []).push(row.column_name);
      }
      return map;
    })
    .catch((error) => {
      readableColumnsCache = null;
      throw error;
    });
  return readableColumnsCache;
}

async function runScopedQuery(sql: string, organizationId: string) {
  const scoped = scopeSqlToOrganization(sql, await readableColumns());
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await tx.$executeRawUnsafe(`SET TRANSACTION READ ONLY`);
    return tx.$queryRawUnsafe<Record<string, unknown>[]>(scoped, organizationId);
  });
}

/** Last-resort readable rendering when the phrasing call is unavailable. */
function renderRows(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "That query returned no rows.";
  const first = rows[0]!;
  const keys = Object.keys(first);
  if (rows.length === 1 && keys.length === 1) {
    return `${String(first[keys[0]!])}`;
  }
  return rows
    .slice(0, 20)
    .map((row) => `• ${keys.map((key) => `${key}: ${String(row[key])}`).join(" · ")}`)
    .join("\n");
}

export type CopilotSqlAnswer = { answer: string } | null;

/**
 * Answer a free-form workforce question by writing a guarded SELECT, running it
 * against the caller's organization, and phrasing the rows.
 *
 * Returns null when the question is not answerable from these tables, so the
 * caller can fall back to chat.
 */
export async function answerFromSql(input: {
  question: string;
  organizationId: string;
  history: { role: "user" | "assistant"; body: string }[];
  today: string;
}): Promise<CopilotSqlAnswer> {
  if (!isAiConfigured()) return null;

  let sql: string;
  try {
    const { output } = await generateText({
      model: model(),
      output: Output.object({ schema: querySchema }),
      system: `You translate an HR staff question into one Postgres query for PeoplePay360.

${SQL_SCHEMA_CATALOG}

${SQL_QUERY_RULES}

Today is ${input.today} (Asia/Kolkata).
Set answerable=false only when the question cannot be answered from these tables at all, or when it asks for salary, bank, or password data. Otherwise set answerable=true and return the SQL in "sql".
Return SQL only — no prose, no markdown fences.`,
      prompt: JSON.stringify({
        question: input.question,
        history: input.history.slice(-6),
      }),
    });
    if (!output?.answerable || !output.sql.trim()) return null;
    sql = output.sql;
  } catch (error) {
    logger.warn("copilot.sql.plan_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const guarded = guardSelectSql(sql, SQL_MAX_ROWS);
  if (!guarded.ok) {
    logger.warn("copilot.sql.rejected", { reason: guarded.error, sql });
    return null;
  }

  let rows: Record<string, unknown>[];
  try {
    rows = await runScopedQuery(guarded.sql, input.organizationId);
  } catch (error) {
    logger.warn("copilot.sql.exec_failed", {
      error: error instanceof Error ? error.message : String(error),
      sql: guarded.sql,
    });
    return null;
  }

  const safeRows = jsonSafe(rows) as Record<string, unknown>[];
  logger.info("copilot.sql.answered", { rows: safeRows.length });

  try {
    const { text } = await generateText({
      model: model(),
      system: `You state the result of an HR database query for a staff user.
Use only the rows provided — never add numbers that are not there.
Answer the question directly in 1–3 short sentences. If the rows are a list, use "• " bullets, one per line, and no more than 15.
No preamble, no mention of SQL, queries, tables, or the dashboard.
Never report salary, wage, or bank details.`,
      prompt: JSON.stringify({
        question: input.question,
        rows: safeRows.slice(0, 30),
        rowCount: safeRows.length,
      }),
    });
    const answer = text.trim();
    return { answer: answer || renderRows(safeRows) };
  } catch {
    return { answer: renderRows(safeRows) };
  }
}
