/**
 * Validates model-generated SQL before it touches Postgres.
 *
 * The model only ever produces a single read-only SELECT that is scoped to the
 * caller's organization through the `$1` bind parameter. Everything else is
 * rejected here rather than trusted to prompt wording.
 */

/** Tables the copilot may read. Anything else (auth, sessions, jobs) is off limits. */
export const SQL_ALLOWED_TABLES = [
  "employee_profile",
  "department",
  "working_schedule",
  "working_schedule_line",
  "contract",
  "time_off_type",
  "time_off_allocation",
  "leave_request",
  "attendance",
  "attendance_daily_rollup",
  "salary_structure",
  "payrun",
  "performance_cycle",
  "performance_review",
  "performance_goal",
  "job_opening",
  "candidate",
] as const;

/** Columns that must never leave the database through the copilot. */
const DENIED_COLUMNS = [
  "wage",
  "bankaccount",
  "basic",
  "gross",
  "net",
  "deductions",
  "hrapct",
  "allowancepct",
  "password",
  "token",
  "personalemail",
  "address",
];

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|reindex|refresh|merge|call|execute|prepare|deallocate|begin|commit|rollback|savepoint|listen|notify|lock|into|set|reset|discard|cluster|comment|import|security|do)\b/i;

const DANGEROUS_IDENTIFIERS =
  /(pg_|information_schema|current_setting|set_config|dblink|lo_import|lo_export|pg_sleep|version\s*\(|user\s*\(\s*\)|session_user|current_user)/i;

const TABLE_REFERENCE = /\b(?:from|join)\s+("?)([a-zA-Z_][a-zA-Z0-9_]*)\1/gi;
/** `WITH x AS (` / `, x AS (` — a CTE name is not a real table. */
const CTE_NAME = /(?:\bwith\b|,)\s*("?)([a-zA-Z_][a-zA-Z0-9_]*)\1\s+as\s*\(/gi;

export const SQL_MAX_ROWS = 60;

export type SqlGuardResult =
  | { ok: true; sql: string }
  | { ok: false; error: string };

/** Strip markdown fences and a single trailing semicolon. */
function normalize(raw: string) {
  return raw
    .replace(/^\s*```(?:sql)?/i, "")
    .replace(/```\s*$/, "")
    .trim()
    .replace(/;\s*$/, "")
    .trim();
}

/**
 * Blank out `EXTRACT(YEAR FROM "joinDate")` and friends.
 *
 * These use FROM as function syntax, not as a table reference, so the table
 * scan below would otherwise read "joinDate" as a table name.
 */
const FROM_FUNCTIONS = /\b(?:extract|substring|substr|trim|overlay|position)\s*\(/gi;

function maskFromFunctions(sql: string) {
  let masked = sql;
  for (const match of [...sql.matchAll(FROM_FUNCTIONS)].reverse()) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < masked.length; i += 1) {
      if (masked[i] === "(") depth += 1;
      else if (masked[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          masked = masked.slice(0, open + 1) + " ".repeat(i - open - 1) + masked.slice(i);
          break;
        }
      }
    }
  }
  return masked;
}

/** True when the statement has a LIMIT outside of any parenthesised subquery. */
function hasTopLevelLimit(sql: string) {
  let depth = 0;
  const lower = sql.toLowerCase();
  for (let i = 0; i < lower.length; i += 1) {
    const char = lower[i];
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && lower.startsWith("limit", i)) {
      const before = i === 0 ? " " : lower[i - 1]!;
      const after = lower[i + 5] ?? " ";
      if (/\s|\)/.test(before) && /\s|\d/.test(after)) return true;
    }
  }
  return false;
}

export function guardSelectSql(raw: string, maxRows = SQL_MAX_ROWS): SqlGuardResult {
  const sql = normalize(raw ?? "");
  if (!sql) return { ok: false, error: "Empty query." };

  if (sql.includes(";")) return { ok: false, error: "Only one statement is allowed." };
  if (sql.includes("--") || sql.includes("/*")) {
    return { ok: false, error: "Comments are not allowed." };
  }
  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, error: "Only SELECT queries are allowed." };
  }
  if (FORBIDDEN_KEYWORDS.test(sql)) {
    return { ok: false, error: "Query contains a non-read keyword." };
  }
  if (DANGEROUS_IDENTIFIERS.test(sql)) {
    return { ok: false, error: "Query touches a restricted identifier." };
  }

  const lower = sql.toLowerCase();
  for (const column of DENIED_COLUMNS) {
    if (new RegExp(`\\b${column}\\b`, "i").test(lower)) {
      return { ok: false, error: `Column “${column}” is not readable by the assistant.` };
    }
  }

  const allowed = new Set<string>(SQL_ALLOWED_TABLES);
  for (const match of sql.matchAll(CTE_NAME)) {
    const name = (match[2] ?? "").toLowerCase();
    if (name) allowed.add(name);
  }

  const scannable = maskFromFunctions(sql);
  const seen: string[] = [];
  for (const match of scannable.matchAll(TABLE_REFERENCE)) {
    const table = (match[2] ?? "").toLowerCase();
    if (!table) continue;
    seen.push(table);
    if (!allowed.has(table)) {
      return { ok: false, error: `Table “${table}” is not available.` };
    }
  }
  if (seen.length === 0) return { ok: false, error: "Query does not read any table." };

  if (!/"organizationId"\s*=\s*\$1/.test(sql)) {
    return { ok: false, error: "Query must be scoped with \"organizationId\" = $1." };
  }
  if (/\$(?!1\b)\d+/.test(sql)) {
    return { ok: false, error: "Only the $1 organization parameter is allowed." };
  }

  return {
    ok: true,
    sql: hasTopLevelLimit(sql) ? sql : `${sql} LIMIT ${maxRows}`,
  };
}
