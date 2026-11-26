import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { currentPayrollMonth, dateFromKey, kolkataTodayKey } from "@/lib/shared/dates";
import {
  sqlAttendanceSummaryQuery,
  sqlLeaveTodayQuery,
  sqlPendingLeaveQuery,
} from "./copilot-query-sql";

export type DepartmentHeadcountRow = {
  id: string;
  name: string;
  code: string;
  headcount: number;
};

function asCount(value: unknown) {
  return Number(value ?? 0);
}

function ilikeContains(value: string) {
  return `%${value.replace(/[%_]/g, "")}%`;
}

function ilikePrefix(value: string) {
  return `${value.replace(/[%_]/g, "")}%`;
}

/** Roster size — matches Employees “Total Employees” / dashboard headcount. */
export async function sqlOrgHeadcount(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ headcount: number }>>(
    Prisma.sql`
      SELECT COUNT(*)::int AS headcount
      FROM employee_profile p
      WHERE p."organizationId" = ${organizationId}
    `,
  );
  return asCount(rows[0]?.headcount);
}

/**
 * Active headcount aligned with the Employees directory KPI:
 * status = active, and not on approved leave today.
 */
export async function sqlOrgActiveHeadcount(organizationId: string) {
  const today = dateFromKey(kolkataTodayKey());
  const rows = await prisma.$queryRaw<Array<{ headcount: number }>>(
    Prisma.sql`
      SELECT COUNT(*)::int AS headcount
      FROM employee_profile p
      WHERE p."organizationId" = ${organizationId}
        AND p.status::text = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM leave_request lr
          WHERE lr."userId" = p."userId"
            AND lr.status::text = 'approved'
            AND lr."startDate" <= ${today}
            AND lr."endDate" >= ${today}
        )
    `,
  );
  return asCount(rows[0]?.headcount);
}

function mapDepartmentRows(
  rows: Array<{ id: string; name: string; code: string; headcount: number }>,
) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    headcount: asCount(row.headcount),
  })) satisfies DepartmentHeadcountRow[];
}

/**
 * Department roster sizes — matches Departments page `employeeCount`
 * (all profiles in the department, including inactive).
 * Name match order: exact → prefix → contains.
 */
export async function sqlDepartmentHeadcount(organizationId: string, departmentName?: string) {
  const needle = departmentName?.trim();
  if (!needle) {
    const rows = await prisma.$queryRaw<Array<{ id: string; name: string; code: string; headcount: number }>>(
      Prisma.sql`
        SELECT d.id, d.name, d.code, COUNT(p.id)::int AS headcount
        FROM department d
        LEFT JOIN employee_profile p ON p."departmentId" = d.id
        WHERE d."organizationId" = ${organizationId}
        GROUP BY d.id, d.name, d.code
        ORDER BY d.name ASC
      `,
    );
    return mapDepartmentRows(rows);
  }

  const exact = await prisma.$queryRaw<Array<{ id: string; name: string; code: string; headcount: number }>>(
    Prisma.sql`
      SELECT d.id, d.name, d.code, COUNT(p.id)::int AS headcount
      FROM department d
      LEFT JOIN employee_profile p ON p."departmentId" = d.id
      WHERE d."organizationId" = ${organizationId}
        AND lower(d.name) = lower(${needle})
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `,
  );
  if (exact.length > 0) return mapDepartmentRows(exact);

  const prefix = await prisma.$queryRaw<Array<{ id: string; name: string; code: string; headcount: number }>>(
    Prisma.sql`
      SELECT d.id, d.name, d.code, COUNT(p.id)::int AS headcount
      FROM department d
      LEFT JOIN employee_profile p ON p."departmentId" = d.id
      WHERE d."organizationId" = ${organizationId}
        AND d.name ILIKE ${ilikePrefix(needle)}
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `,
  );
  if (prefix.length > 0) return mapDepartmentRows(prefix);

  const contains = await prisma.$queryRaw<Array<{ id: string; name: string; code: string; headcount: number }>>(
    Prisma.sql`
      SELECT d.id, d.name, d.code, COUNT(p.id)::int AS headcount
      FROM department d
      LEFT JOIN employee_profile p ON p."departmentId" = d.id
      WHERE d."organizationId" = ${organizationId}
        AND d.name ILIKE ${ilikeContains(needle)}
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name ASC
    `,
  );
  return mapDepartmentRows(contains);
}

export async function sqlPeopleInDepartment(organizationId: string, departmentName: string) {
  const depts = await sqlDepartmentHeadcount(organizationId, departmentName);
  if (depts.length === 0) {
    return { department: null as DepartmentHeadcountRow | null, people: [] as Array<{
      fullName: string;
      employeeId: string;
      jobTitle: string;
      status: string;
    }>, total: 0, matches: [] as DepartmentHeadcountRow[] };
  }
  if (depts.length > 1) {
    return {
      department: null as DepartmentHeadcountRow | null,
      people: [] as Array<{ fullName: string; employeeId: string; jobTitle: string; status: string }>,
      total: 0,
      matches: depts,
    };
  }
  const dept = depts[0]!;
  const people = await prisma.$queryRaw<
    Array<{ fullName: string; employeeId: string; jobTitle: string; status: string }>
  >(
    Prisma.sql`
      SELECT p."fullName", p."employeeId", p."jobTitle", p.status::text AS status
      FROM employee_profile p
      WHERE p."organizationId" = ${organizationId}
        AND p."departmentId" = ${dept.id}
      ORDER BY p."fullName" ASC
      LIMIT 25
    `,
  );
  return { department: dept, people, total: dept.headcount, matches: [] as DepartmentHeadcountRow[] };
}

export async function sqlFindPeople(organizationId: string, query: string) {
  const needle = ilikeContains(query.trim());
  return prisma.$queryRaw<
    Array<{
      fullName: string;
      employeeId: string;
      jobTitle: string;
      department: string;
      phone: string | null;
      status: string;
    }>
  >(
    Prisma.sql`
      SELECT p."fullName", p."employeeId", p."jobTitle", d.name AS department, p.phone, p.status::text AS status
      FROM employee_profile p
      INNER JOIN department d ON d.id = p."departmentId"
      WHERE p."organizationId" = ${organizationId}
        AND (
          p."fullName" ILIKE ${needle}
          OR p."employeeId" ILIKE ${needle}
          OR COALESCE(p.phone, '') ILIKE ${needle}
        )
      ORDER BY p."fullName" ASC
      LIMIT 8
    `,
  );
}

export async function sqlLeaveToday(organizationId: string) {
  const today = dateFromKey(kolkataTodayKey());
  const [countRow, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM leave_request lr
        WHERE lr."organizationId" = ${organizationId}
          AND lr.status::text = 'approved'
          AND lr."startDate" <= ${today}
          AND lr."endDate" >= ${today}
      `,
    ),
    prisma.$queryRaw<Array<{ fullName: string; employeeId: string; department: string }>>(
      sqlLeaveTodayQuery(organizationId, today),
    ),
  ]);
  return { total: asCount(countRow[0]?.total), rows };
}

export async function sqlPendingLeave(organizationId: string) {
  const [countRow, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM leave_request lr
        WHERE lr."organizationId" = ${organizationId}
          AND lr.status::text = 'pending'
      `,
    ),
    prisma.$queryRaw<Array<{ fullName: string; employeeId: string; startDate: Date; endDate: Date }>>(
      sqlPendingLeaveQuery(organizationId),
    ),
  ]);
  return { total: asCount(countRow[0]?.total), rows };
}

export async function sqlAttendanceSummary(organizationId: string) {
  const todayKey = kolkataTodayKey();
  const today = dateFromKey(todayKey);
  const monthStart = dateFromKey(`${currentPayrollMonth()}-01`);
  const rows = await prisma.$queryRaw<
    Array<{
      monthRows: number;
      monthPresent: number;
      todayPresent: number;
      todayAbsent: number;
      todayLeave: number;
    }>
  >(sqlAttendanceSummaryQuery(organizationId, monthStart, today));
  return rows[0] ?? { monthRows: 0, monthPresent: 0, todayPresent: 0, todayAbsent: 0, todayLeave: 0 };
}

export async function sqlLatestPaidPayrollNet(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ name: string; net: number; slips: number }>>(
    Prisma.sql`
      SELECT pr.name, COALESCE(SUM(s.net), 0)::float AS net, COUNT(s.id)::int AS slips
      FROM payrun pr
      LEFT JOIN payslip s ON s."payrunId" = pr.id
      WHERE pr.id = (
        SELECT id FROM payrun
        WHERE "organizationId" = ${organizationId}
          AND status::text = 'paid'
        ORDER BY "periodEnd" DESC
        LIMIT 1
      )
      GROUP BY pr.name
    `,
  );
  return rows[0] ?? null;
}

export async function sqlPerformanceSummary(organizationId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ avgRating: number | null; draft: number; submitted: number; acknowledged: number }>
  >(
    Prisma.sql`
      SELECT
        AVG(r."overallRating")::float AS "avgRating",
        COUNT(*) FILTER (WHERE r.status::text = 'draft')::int AS draft,
        COUNT(*) FILTER (WHERE r.status::text = 'submitted')::int AS submitted,
        COUNT(*) FILTER (WHERE r.status::text = 'acknowledged')::int AS acknowledged
      FROM performance_review r
      INNER JOIN performance_cycle c ON c.id = r."cycleId"
      WHERE c."organizationId" = ${organizationId}
    `,
  );
  return rows[0] ?? { avgRating: null, draft: 0, submitted: 0, acknowledged: 0 };
}
