"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { kolkataTodayKey } from "@/lib/shared/dates";
import {
  createDepartmentSchema,
  deleteDepartmentSchema,
  firstZodError,
  moveEmployeeDepartmentSchema,
  renameDepartmentSchema,
} from "@/lib/shared/validations";
import { departmentCodeFromName } from "@/lib/people/department-code";
import type { ActionResult } from "@/lib/shared/types";

export type DepartmentListItem = {
  id: string;
  name: string;
  code: string;
  description: string;
  employeeCount: number;
  managerName: string;
  status: "Active" | "Inactive";
  members: { name: string; email: string; jobTitle: string; employeeId: string }[];
};

const DESCRIPTIONS: Record<string, string> = {
  Engineering: "Builds and maintains product, dashboards, and platform services.",
  "Human Resources": "Owns hiring, employee relations, leave, and workplace culture.",
  Sales: "Drives customer acquisition and revenue growth.",
  Marketing: "Brand, campaigns, and go-to-market.",
  Finance: "Accounting, budgets, payroll compliance, and audits.",
};

function mapDepartment(
  dept: {
    id: string;
    name: string;
    code: string;
    profiles: {
      userId: string;
      fullName: string;
      jobTitle: string;
      employeeId: string;
      role: string;
      status: string;
      user: { email: string };
    }[];
  },
  leaveSet: Set<string>,
): DepartmentListItem {
  const members = dept.profiles;
  const manager =
    members.find((m) => m.role === "hr_manager" || m.role === "admin") ?? members[0];
  const activeCount = members.filter(
    (m) => m.status === "active" && !leaveSet.has(m.userId),
  ).length;
  return {
    id: dept.id,
    name: dept.name,
    code: dept.code,
    description:
      DESCRIPTIONS[dept.name] ?? `Team directory for ${dept.name}.`,
    employeeCount: members.length,
    managerName: manager?.fullName ?? "—",
    status: members.length === 0 || activeCount > 0 ? "Active" : "Inactive",
    members: members.map((m) => ({
      name: m.fullName,
      email: m.user.email,
      jobTitle: m.jobTitle,
      employeeId: m.employeeId,
    })),
  };
}

async function leaveUserIdsToday() {
  const today = kolkataTodayKey();
  const onLeave = await prisma.leaveRequest.findMany({
    where: {
      status: "approved",
      startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
      endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
    },
    select: { userId: true },
  });
  return new Set(onLeave.map((row) => row.userId));
}

export async function listDepartments(): Promise<ActionResult<DepartmentListItem[]>> {
  try {
    await requirePermission("managePeople");
    const [departments, leaveSet] = await Promise.all([
      prisma.department.findMany({
        include: {
          profiles: {
            include: { user: { select: { email: true } } },
            orderBy: { fullName: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      leaveUserIdsToday(),
    ]);

    return {
      ok: true,
      data: departments.map((dept) => mapDepartment(dept, leaveSet)),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load departments.") };
  }
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
      include: {
        profiles: {
          include: { user: { select: { email: true } } },
          orderBy: { fullName: "asc" },
        },
      },
    });

    revalidatePath("/admin/people/department");
    revalidatePath("/admin/people/employees");
    return { ok: true, data: mapDepartment(created, await leaveUserIdsToday()) };
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

    const updated = await prisma.department.update({
      where: { id: parsed.data.id },
      data: { name: parsed.data.name.trim() },
      include: {
        profiles: {
          include: { user: { select: { email: true } } },
          orderBy: { fullName: "asc" },
        },
      },
    });

    revalidatePath("/admin/people/department");
    revalidatePath("/admin/people/employees");
    return { ok: true, data: mapDepartment(updated, await leaveUserIdsToday()) };
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
    member: DepartmentListItem["members"][number];
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
