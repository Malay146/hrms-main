"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import {
  clampPage,
  clampPageSize,
  pageSkip,
  totalPagesFor,
  type PagedResult,
} from "@/lib/shared/pagination";
import {
  createDepartmentSchema,
  deleteDepartmentSchema,
  firstZodError,
  moveEmployeeDepartmentSchema,
  renameDepartmentSchema,
} from "@/lib/shared/validations";
import { departmentCodeFromName } from "@/lib/people/department-code";
import type { ActionResult } from "@/lib/shared/types";

export type DepartmentMember = {
  name: string;
  email: string;
  jobTitle: string;
  employeeId: string;
};

export type DepartmentListItem = {
  id: string;
  name: string;
  code: string;
  description: string;
  employeeCount: number;
  managerName: string;
  status: "Active" | "Inactive";
  members: DepartmentMember[];
};

const DESCRIPTIONS: Record<string, string> = {
  Engineering: "Builds and maintains product, dashboards, and platform services.",
  "Human Resources": "Owns hiring, employee relations, leave, and workplace culture.",
  Sales: "Drives customer acquisition and revenue growth.",
  Marketing: "Brand, campaigns, and go-to-market.",
  Finance: "Accounting, budgets, payroll compliance, and audits.",
};

const profileSelect = {
  userId: true,
  fullName: true,
  jobTitle: true,
  employeeId: true,
  role: true,
  status: true,
  user: { select: { email: true } },
} as const;

function mapMember(m: {
  fullName: string;
  jobTitle: string;
  employeeId: string;
  user: { email: string };
}): DepartmentMember {
  return {
    name: m.fullName,
    email: m.user.email,
    jobTitle: m.jobTitle,
    employeeId: m.employeeId,
  };
}

function mapDepartment(input: {
  id: string;
  name: string;
  code: string;
  employeeCount: number;
  managerName: string;
  status: "Active" | "Inactive";
  members: DepartmentMember[];
}): DepartmentListItem {
  return {
    id: input.id,
    name: input.name,
    code: input.code,
    description: DESCRIPTIONS[input.name] ?? `Team directory for ${input.name}.`,
    employeeCount: input.employeeCount,
    managerName: input.managerName,
    status: input.status,
    members: input.members,
  };
}

export async function listDepartments(): Promise<ActionResult<DepartmentListItem[]>> {
  try {
    await requirePermission("managePeople");
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { profiles: true } },
        profiles: {
          select: profileSelect,
          orderBy: { fullName: "asc" },
          take: 5,
        },
      },
      orderBy: { name: "asc" },
    });

    const deptIds = departments.map((d) => d.id);
    const [managers, activeGroups] = await Promise.all([
      deptIds.length === 0
        ? Promise.resolve([])
        : prisma.employeeProfile.findMany({
            where: {
              departmentId: { in: deptIds },
              role: { in: ["admin", "hr_manager"] },
            },
            select: { departmentId: true, fullName: true },
            orderBy: [{ departmentId: "asc" }, { fullName: "asc" }],
          }),
      deptIds.length === 0
        ? Promise.resolve([])
        : prisma.employeeProfile.groupBy({
            by: ["departmentId"],
            where: {
              departmentId: { in: deptIds },
              status: "active",
            },
            _count: { _all: true },
          }),
    ]);

    const managerByDept = new Map<string, string>();
    for (const row of managers) {
      if (!managerByDept.has(row.departmentId)) {
        managerByDept.set(row.departmentId, row.fullName);
      }
    }
    const activeByDept = new Map(activeGroups.map((row) => [row.departmentId, row._count._all]));

    return {
      ok: true,
      data: departments.map((dept) => {
        const preview = dept.profiles;
        const managerName =
          managerByDept.get(dept.id) ??
          preview.find((m) => m.role === "hr_manager" || m.role === "admin")?.fullName ??
          preview[0]?.fullName ??
          "—";
        const employeeCount = dept._count.profiles;
        const activeCount = activeByDept.get(dept.id) ?? 0;
        return mapDepartment({
          id: dept.id,
          name: dept.name,
          code: dept.code,
          employeeCount,
          managerName,
          status: employeeCount === 0 || activeCount > 0 ? "Active" : "Inactive",
          members: preview.map(mapMember),
        });
      }),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load departments.") };
  }
}

export async function listDepartmentMembers(input: {
  departmentId: string;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<ActionResult<PagedResult<DepartmentMember>>> {
  try {
    await requirePermission("managePeople");
    const page = clampPage(input.page);
    const pageSize = clampPageSize(input.pageSize);
    const search = input.search?.trim() ?? "";
    const where = {
      departmentId: input.departmentId,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { employeeId: { contains: search, mode: "insensitive" as const } },
              { jobTitle: { contains: search, mode: "insensitive" as const } },
              { user: { email: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.employeeProfile.count({ where }),
      prisma.employeeProfile.findMany({
        where,
        select: profileSelect,
        orderBy: { fullName: "asc" },
        skip: pageSkip(page, pageSize),
        take: pageSize,
      }),
    ]);
    return {
      ok: true,
      data: {
        rows: rows.map(mapMember),
        page,
        pageSize,
        total,
        totalPages: totalPagesFor(total, pageSize),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load department members.") };
  }
}

async function departmentForMutation(id: string): Promise<DepartmentListItem | null> {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      _count: { select: { profiles: true } },
      profiles: {
        select: profileSelect,
        orderBy: { fullName: "asc" },
        take: 20,
      },
    },
  });
  if (!dept) return null;
  const manager =
    (await prisma.employeeProfile.findFirst({
      where: { departmentId: dept.id, role: { in: ["admin", "hr_manager"] } },
      select: { fullName: true },
      orderBy: { fullName: "asc" },
    })) ?? dept.profiles[0];
  const activeCount = await prisma.employeeProfile.count({
    where: { departmentId: dept.id, status: "active" },
  });
  return mapDepartment({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    employeeCount: dept._count.profiles,
    managerName: manager?.fullName ?? "—",
    status: dept._count.profiles === 0 || activeCount > 0 ? "Active" : "Inactive",
    members: dept.profiles.map(mapMember),
  });
}

export async function createDepartmentAction(input: {
  name: string;
  code?: string;
}): Promise<ActionResult<DepartmentListItem>> {
  try {
    const user = await requirePermission("managePeople");
    const parsed = createDepartmentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) {
      return { ok: false, error: "Your employee profile is missing." };
    }

    const name = parsed.data.name.trim();
    const code = (parsed.data.code ?? departmentCodeFromName(name)).toUpperCase();

    const existing = await prisma.department.findUnique({
      where: {
        organizationId_code: {
          organizationId: profile.organizationId,
          code,
        },
      },
    });
    if (existing) {
      return { ok: false, error: "A department with this code already exists." };
    }

    const created = await prisma.department.create({
      data: {
        organizationId: profile.organizationId,
        name,
        code,
      },
    });

    revalidatePath("/admin/people/department");
    revalidatePath("/admin/people/employees");
    return {
      ok: true,
      data: mapDepartment({
        id: created.id,
        name: created.name,
        code: created.code,
        employeeCount: 0,
        managerName: "—",
        status: "Active",
        members: [],
      }),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not create department.") };
  }
}

export async function renameDepartmentAction(input: {
  id: string;
  name: string;
}): Promise<ActionResult<DepartmentListItem>> {
  try {
    await requirePermission("managePeople");
    const parsed = renameDepartmentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    await prisma.department.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name.trim() },
    });

    const mapped = await departmentForMutation(parsed.data.id);
    if (!mapped) return { ok: false, error: "Department not found." };

    revalidatePath("/admin/people/department");
    revalidatePath("/admin/people/employees");
    return { ok: true, data: mapped };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not rename department.") };
  }
}

export async function deleteDepartmentAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("managePeople");
    const parsed = deleteDepartmentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const department = await prisma.department.findUnique({
      where: { id: parsed.data.id },
      include: {
        _count: { select: { profiles: true, contracts: true } },
      },
    });
    if (!department) {
      return { ok: false, error: "Department not found." };
    }
    if (department._count.profiles > 0) {
      return {
        ok: false,
        error: `Cannot delete ${department.name}. Reassign its ${department._count.profiles} employee(s) first.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      if (department._count.contracts > 0) {
        await tx.contract.updateMany({
          where: { departmentId: department.id },
          data: { departmentId: null },
        });
      }
      await tx.department.delete({ where: { id: department.id } });
    });

    revalidatePath("/admin/people/department");
    revalidatePath("/admin/people/employees");
    revalidatePath("/admin/people/contracts");
    return { ok: true, data: { id: department.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete department.") };
  }
}

export async function moveEmployeeDepartmentAction(input: {
  employeeId: string;
  departmentId: string;
}): Promise<
  ActionResult<{
    employeeId: string;
    fromDepartmentId: string;
    toDepartmentId: string;
    member: DepartmentMember;
  }>
> {
  try {
    await requirePermission("managePeople");
    const parsed = moveEmployeeDepartmentSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: { employeeId: parsed.data.employeeId },
      include: { user: { select: { email: true } } },
    });
    if (!profile) {
      return { ok: false, error: "Employee not found." };
    }
    if (profile.departmentId === parsed.data.departmentId) {
      return { ok: false, error: "Employee is already in that department." };
    }

    const target = await prisma.department.findFirst({
      where: {
        id: parsed.data.departmentId,
        organizationId: profile.organizationId,
      },
    });
    if (!target) {
      return { ok: false, error: "Target department not found." };
    }

    const fromDepartmentId = profile.departmentId;
    await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: { departmentId: target.id },
    });

    revalidatePath("/admin/people/department");
    revalidatePath("/admin/people/employees");
    revalidatePath(`/admin/people/employees/${profile.employeeId}`);

    return {
      ok: true,
      data: {
        employeeId: profile.employeeId,
        fromDepartmentId,
        toDepartmentId: target.id,
        member: {
          name: profile.fullName,
          email: profile.user.email,
          jobTitle: profile.jobTitle,
          employeeId: profile.employeeId,
        },
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not move employee.") };
  }
}
