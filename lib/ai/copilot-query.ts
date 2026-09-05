import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { currentPayrollMonth, dateFromKey, kolkataTodayKey } from "@/lib/shared/dates";

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

export async function sqlOrgHeadcount(organizationId: string) {
  const rows = await prisma.$queryRaw<Array<{ headcount: number }>>(
    Prisma.sql`
      SELECT COUNT(*)::int AS headcount
      FROM employee_profile p
      WHERE p."organizationId" = ${organizationId}
        AND p.status::text <> 'inactive'
    `,
  );
  return asCount(rows[0]?.headcount);
}

export async function sqlDepartmentHeadcount(organizationId: string, departmentName?: string) {
  const needle = departmentName?.trim();
  const rows = needle
    ? await prisma.$queryRaw<Array<{ id: string; name: string; code: string; headcount: number }>>(
        Prisma.sql`
          SELECT d.id, d.name, d.code, COUNT(p.id)::int AS headcount
          FROM department d
          LEFT JOIN employee_profile p
            ON p."departmentId" = d.id
            AND p.status::text <> 'inactive'
          WHERE d."organizationId" = ${organizationId}
            AND d.name ILIKE ${ilikeContains(needle)}
          GROUP BY d.id, d.name, d.code
          ORDER BY d.name ASC
        `,
      )
    : await prisma.$queryRaw<Array<{ id: string; name: string; code: string; headcount: number }>>(
        Prisma.sql`
          SELECT d.id, d.name, d.code, COUNT(p.id)::int AS headcount
          FROM department d
          LEFT JOIN employee_profile p
            ON p."departmentId" = d.id
            AND p.status::text <> 'inactive'
          WHERE d."organizationId" = ${organizationId}
          GROUP BY d.id, d.name, d.code
          ORDER BY d.name ASC
        `,
      );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    headcount: asCount(row.headcount),
  })) satisfies DepartmentHeadcountRow[];
}

export async function sqlPeopleInDepartment(organizationId: string, departmentName: string) {
  return prisma.$queryRaw<Array<{ fullName: string; employeeId: string; jobTitle: string; status: string }>>(
    Prisma.sql`
      SELECT p."fullName", p."employeeId", p."jobTitle", p.status::text AS status
      FROM employee_profile p
      INNER JOIN department d ON d.id = p."departmentId"
      WHERE p."organizationId" = ${organizationId}
        AND d.name ILIKE ${ilikeContains(departmentName.trim())}
        AND p.status::text <> 'inactive'
      ORDER BY p."fullName" ASC
      LIMIT 40
    `,
  );
}

export async function sqlFindPeople(organizationId: string, query: string) {
  const needle = ilikeContains(query.trim());
  return prisma.$queryRaw<
    Array<{ fullName: string; employeeId: string; jobTitle: string; department: string; phone: string | null; status: string }>
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
  return prisma.$queryRaw<Array<{ fullName: string; employeeId: string; department: string }>>(
    Prisma.sql`
      SELECT p."fullName", p."employeeId", d.name AS department
      FROM leave_request lr
      INNER JOIN "user" u ON u.id = lr."userId"
      INNER JOIN employee_profile p ON p."userId" = u.id
      INNER JOIN department d ON d.id = p."departmentId"
      WHERE p."organizationId" = ${organizationId}
        AND lr.status::text = 'approved'
        AND lr."startDate" <= ${today}
        AND lr."endDate" >= ${today}
      ORDER BY p."fullName" ASC
      LIMIT 50
    `,
  );
}

export async function sqlPendingLeave(organizationId: string) {
  return prisma.$queryRaw<Array<{ fullName: string; employeeId: string; startDate: Date; endDate: Date }>>(
    Prisma.sql`
      SELECT p."fullName", p."employeeId", lr."startDate", lr."endDate"
      FROM leave_request lr
      INNER JOIN "user" u ON u.id = lr."userId"
      INNER JOIN employee_profile p ON p."userId" = u.id
      WHERE p."organizationId" = ${organizationId}
        AND lr.status::text = 'pending'
      ORDER BY lr."createdAt" ASC
      LIMIT 40
    `,
  );
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
  >(
    Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE a.date >= ${monthStart} AND a.date <= ${today})::int AS "monthRows",
        COUNT(*) FILTER (
          WHERE a.date >= ${monthStart} AND a.date <= ${today}
            AND a.status::text IN ('present', 'half_day')
        )::int AS "monthPresent",
        COUNT(*) FILTER (WHERE a.date = ${today} AND a.status::text = 'present')::int AS "todayPresent",
        COUNT(*) FILTER (WHERE a.date = ${today} AND a.status::text = 'absent')::int AS "todayAbsent",
        COUNT(*) FILTER (WHERE a.date = ${today} AND a.status::text = 'leave')::int AS "todayLeave"
      FROM attendance a
      INNER JOIN employee_profile p ON p."userId" = a."userId"
      WHERE p."organizationId" = ${organizationId}
        AND p.status::text <> 'inactive'
    `,
  );
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
