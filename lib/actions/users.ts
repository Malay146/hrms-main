"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { firstZodError } from "@/lib/shared/validations";
import type { ActionResult, Role } from "@/lib/shared/types";
import { ASSIGNABLE_ROLES } from "@/lib/auth/permissions";
import { z } from "zod";

const updateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "employee"]),
  status: z.enum(["active", "inactive"]).optional(),
});

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
  employeeName: string | null;
  status: string;
};

export async function listManagedUsers(): Promise<ActionResult<ManagedUser[]>> {
  try {
    await requirePermission("createUsers");
    const rows = await prisma.user.findMany({
      include: { profile: { select: { employeeId: true, fullName: true, status: true } } },
      orderBy: { email: "asc" },
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role as Role,
        employeeId: row.profile?.employeeId ?? null,
        employeeName: row.profile?.fullName ?? null,
        status: row.profile?.status ?? "active",
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load users.") };
  }
}

export async function updateManagedUserAction(input: {
  userId: string;
  role: Role;
  status?: "active" | "inactive";
}): Promise<ActionResult> {
  try {
    const admin = await requirePermission("createUsers");
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    if (parsed.data.userId === admin.id) {
      return { ok: false, error: "You cannot change your own role." };
    }
    if (!ASSIGNABLE_ROLES.includes(parsed.data.role)) {
      return { ok: false, error: "Invalid role." };
    }

    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { role: parsed.data.role },
    });
    if (parsed.data.status) {
      await prisma.employeeProfile.updateMany({
        where: { userId: parsed.data.userId },
        data: { status: parsed.data.status, role: parsed.data.role },
      });
    }
    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not update user.") };
  }
}
