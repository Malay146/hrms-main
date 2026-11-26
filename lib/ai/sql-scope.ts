import { SQL_ALLOWED_TABLES } from "./sql-guard";

/**
 * How each table the copilot may read is limited to one organization ($1).
 * Tables without their own organizationId are scoped through their parent.
 */
const ORG_FILTER: Record<(typeof SQL_ALLOWED_TABLES)[number], string> = {
  employee_profile: `"organizationId" = $1`,
  department: `"organizationId" = $1`,
  working_schedule: `"organizationId" = $1`,
  working_schedule_line: `"scheduleId" IN (SELECT id FROM public.working_schedule WHERE "organizationId" = $1)`,
  contract: `"employeeId" IN (SELECT id FROM public.employee_profile WHERE "organizationId" = $1)`,
  time_off_type: `"organizationId" = $1`,
  time_off_allocation: `"employeeId" IN (SELECT id FROM public.employee_profile WHERE "organizationId" = $1)`,
  leave_request: `"organizationId" = $1`,
  attendance: `"organizationId" = $1`,
  attendance_daily_rollup: `"organizationId" = $1`,
  salary_structure: `"organizationId" = $1`,
  payrun: `"organizationId" = $1`,
  performance_cycle: `"organizationId" = $1`,
  performance_review: `"cycleId" IN (SELECT id FROM public.performance_cycle WHERE "organizationId" = $1)`,
  performance_goal: `"reviewId" IN (SELECT r.id FROM public.performance_review r JOIN public.performance_cycle c ON c.id = r."cycleId" WHERE c."organizationId" = $1)`,
  job_opening: `"organizationId" = $1`,
  candidate: `"organizationId" = $1`,
};

/**
 * Wrap a guarded SELECT so every allowed table name resolves to a CTE holding
 * only this organization's rows and only readable columns. Whatever the model
 * writes (OR true, UNION, SELECT *), it cannot see another tenant's data or a
 * denied column. Postgres skips CTEs the query never references.
 *
 * `readableColumns` maps table -> columns allowed out of the database.
 */
export function scopeSqlToOrganization(sql: string, readableColumns: Record<string, string[]>) {
  const ctes = SQL_ALLOWED_TABLES.map((table) => {
    const columns = readableColumns[table];
    if (!columns || columns.length === 0) {
      throw new Error(`No readable columns known for ${table}.`);
    }
    const list = columns.map((column) => `"${column.replaceAll('"', '""')}"`).join(", ");
    return `${table} AS (SELECT ${list} FROM public.${table} WHERE ${ORG_FILTER[table]})`;
  }).join(",\n");

  const trimmed = sql.trim();
  if (/^with\s+recursive\b/i.test(trimmed)) {
    throw new Error("Recursive queries are not allowed.");
  }
  return /^with\b/i.test(trimmed)
    ? `WITH ${ctes},\n${trimmed.replace(/^with\b/i, "").trimStart()}`
    : `WITH ${ctes}\n${trimmed}`;
}
