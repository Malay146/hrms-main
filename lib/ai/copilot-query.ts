import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

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
