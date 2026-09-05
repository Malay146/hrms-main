import { Prisma } from "@/generated/prisma/client";

export function sqlLeaveTodayQuery(organizationId: string, today: Date) {
  return Prisma.sql`
      SELECT p."fullName", p."employeeId", d.name AS department
      FROM leave_request lr
      INNER JOIN employee_profile p ON p.id = lr."employeeId"
      INNER JOIN department d ON d.id = p."departmentId"
      WHERE lr."organizationId" = ${organizationId}
        AND lr.status::text = 'approved'
        AND lr."startDate" <= ${today}
        AND lr."endDate" >= ${today}
      ORDER BY p."fullName" ASC
      LIMIT 50
    `;
}

export function sqlPendingLeaveQuery(organizationId: string) {
  return Prisma.sql`
      SELECT p."fullName", p."employeeId", lr."startDate", lr."endDate"
      FROM leave_request lr
      INNER JOIN employee_profile p ON p.id = lr."employeeId"
      WHERE lr."organizationId" = ${organizationId}
        AND lr.status::text = 'pending'
      ORDER BY lr."createdAt" ASC
      LIMIT 40
    `;
}

export function sqlAttendanceSummaryQuery(organizationId: string, monthStart: Date, today: Date) {
  return Prisma.sql`
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
      INNER JOIN employee_profile p ON p.id = a."employeeId"
      WHERE a."organizationId" = ${organizationId}
        AND p.status::text <> 'inactive'
    `;
}
