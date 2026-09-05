"use server";

import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/session";
import { kolkataTodayKey } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

export type DepartmentListItem = {
  id: string;
  name: string;
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

export async function listDepartments(): Promise<ActionResult<DepartmentListItem[]>> {
  try {
    await requirePermission("managePeople");
    const today = kolkataTodayKey();
    const [departments, onLeave] = await Promise.all([
      prisma.department.findMany({
        include: {
          profiles: {
            include: { user: { select: { email: true } } },
            orderBy: { fullName: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "approved",
          startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
          endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
        },
        select: { userId: true },
      }),
    ]);

    const leaveSet = new Set(onLeave.map((row) => row.userId));

    const items: DepartmentListItem[] = departments.map((dept) => {
      const members = dept.profiles;
      const manager =
        members.find((m) => m.role === "hr_manager" || m.role === "admin") ?? members[0];
      const activeCount = members.filter(
        (m) => m.status === "active" && !leaveSet.has(m.userId),
      ).length;
      return {
        id: dept.id,
        name: dept.name,
        description:
          DESCRIPTIONS[dept.name] ??
          `Team directory for ${dept.name} based on employee profiles.`,
        employeeCount: members.length,
        managerName: manager?.fullName ?? "—",
        status: activeCount > 0 ? "Active" : "Inactive",
        members: members.map((m) => ({
          name: m.fullName,
          email: m.user.email,
          jobTitle: m.jobTitle,
          employeeId: m.employeeId,
        })),
      };
    });

    return { ok: true, data: items };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load departments.") };
  }
}
