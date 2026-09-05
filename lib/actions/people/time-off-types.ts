"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { firstZodError } from "@/lib/shared/validations";
import { z } from "zod";
import type { ActionResult } from "@/lib/shared/types";

export type TimeOffTypeItem = {
  id: string;
  name: string;
  code: string;
  unit: "days" | "hours";
  requiresAllocation: boolean;
  approver: "manager" | "officer";
  color: string;
  payrollNote: string | null;
};

const upsertTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  code: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/, "Code must be lowercase letters, numbers, underscores."),
  unit: z.enum(["days", "hours"]),
  requiresAllocation: z.boolean(),
  approver: z.enum(["manager", "officer"]),
  color: z.string().default("zinc"),
  payrollNote: z.string().optional().nullable(),
});

export async function listTimeOffTypes(): Promise<ActionResult<TimeOffTypeItem[]>> {
  try {
    await requirePermission("approveLeave");
    const rows = await prisma.timeOffType.findMany({ orderBy: { name: "asc" } });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        unit: row.unit,
        requiresAllocation: row.requiresAllocation,
        approver: row.approver,
        color: row.color,
        payrollNote: row.payrollNote,
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load time off types.") };
  }
}

export async function upsertTimeOffTypeAction(input: {
  id?: string;
  name: string;
  code: string;
  unit: "days" | "hours";
  requiresAllocation: boolean;
  approver: "manager" | "officer";
  color?: string;
  payrollNote?: string | null;
}): Promise<ActionResult<TimeOffTypeItem>> {
  try {
    const user = await requirePermission("manageTimeOffTypes");
    const parsed = upsertTypeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) return { ok: false, error: "Your employee profile is missing." };

    const data = {
      name: parsed.data.name.trim(),
      code: parsed.data.code.trim(),
      unit: parsed.data.unit,
      requiresAllocation: parsed.data.requiresAllocation,
      approver: parsed.data.approver,
      color: parsed.data.color,
      payrollNote: parsed.data.payrollNote?.trim() || null,
    };

    if (parsed.data.id) {
      const existing = await prisma.timeOffType.findFirst({
        where: { id: parsed.data.id, organizationId: profile.organizationId },
      });
      if (!existing) return { ok: false, error: "Time off type not found." };
    }

    const row = parsed.data.id
      ? await prisma.timeOffType.update({ where: { id: parsed.data.id }, data })
      : await prisma.timeOffType.create({
          data: { ...data, organizationId: profile.organizationId },
        });

    revalidatePath("/admin/people/leave/types");
    revalidatePath("/admin/people/leave");
    return {
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        code: row.code,
        unit: row.unit,
        requiresAllocation: row.requiresAllocation,
        approver: row.approver,
        color: row.color,
        payrollNote: row.payrollNote,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save time off type.") };
  }
}

export async function deleteTimeOffTypeAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("manageTimeOffTypes");
    const id = String(input.id ?? "").trim();
    if (!id) return { ok: false, error: "Type id is required." };

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) return { ok: false, error: "Your employee profile is missing." };

    const existing = await prisma.timeOffType.findFirst({
      where: { id, organizationId: profile.organizationId },
      include: {
        _count: { select: { leaveRequests: true, allocations: true } },
      },
    });
    if (!existing) return { ok: false, error: "Time off type not found." };
    if (existing._count.leaveRequests > 0) {
      return {
        ok: false,
        error: `Cannot delete ${existing.name}. It is used by ${existing._count.leaveRequests} leave request(s).`,
      };
    }

    await prisma.$transaction(async (tx) => {
      if (existing._count.allocations > 0) {
        await tx.timeOffAllocation.deleteMany({ where: { typeId: existing.id } });
      }
      await tx.timeOffType.delete({ where: { id: existing.id } });
    });

    revalidatePath("/admin/people/leave/types");
    revalidatePath("/admin/people/leave");
    revalidatePath("/admin/people/leave/allocations");
    return { ok: true, data: { id: existing.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete time off type.") };
  }
}
