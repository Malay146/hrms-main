"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { remaining } from "@/lib/people/time-off-balance";
import { firstZodError } from "@/lib/shared/validations";
import { z } from "zod";
import type { ActionResult } from "@/lib/shared/types";

export type AllocationListItem = {
  id: string;
  employeeProfileId: string;
  employeeCode: string;
  employeeName: string;
  typeId: string;
  typeName: string;
  allocated: number;
  taken: number;
  remaining: number;
  validityYear: number;
  status: "draft" | "approved" | "refused";
  description: string | null;
};

const upsertAllocationSchema = z.object({
  id: z.string().optional(),
  employeeProfileId: z.string().min(1),
  typeId: z.string().min(1),
  allocated: z.number().positive(),
  validityYear: z.number().int().min(2000).max(2100),
  description: z.string().optional().nullable(),
});

function mapAllocation(row: {
  id: string;
  employeeId: string;
  typeId: string;
  allocated: { toString(): string } | number;
  taken: { toString(): string } | number;
  validityYear: number;
  status: "draft" | "approved" | "refused";
  description: string | null;
  employee: { employeeId: string; fullName: string };
  type: { name: string };
}): AllocationListItem {
  const allocated = Number(row.allocated);
  const taken = Number(row.taken);
  return {
    id: row.id,
    employeeProfileId: row.employeeId,
    employeeCode: row.employee.employeeId,
    employeeName: row.employee.fullName,
    typeId: row.typeId,
    typeName: row.type.name,
    allocated,
    taken,
    remaining: remaining(allocated, taken),
    validityYear: row.validityYear,
    status: row.status,
    description: row.description,
  };
}

export async function listAllocations(filters?: {
  employeeCode?: string | null;
}): Promise<ActionResult<AllocationListItem[]>> {
  try {
    await requirePermission("approveLeave");
    const rows = await prisma.timeOffAllocation.findMany({
      where: filters?.employeeCode
        ? { employee: { employeeId: filters.employeeCode } }
        : undefined,
      include: {
        employee: { select: { employeeId: true, fullName: true } },
        type: { select: { name: true } },
      },
      orderBy: [{ validityYear: "desc" }, { createdAt: "desc" }],
    });
    return { ok: true, data: rows.map(mapAllocation) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load allocations.") };
  }
}

export async function upsertAllocationAction(input: {
  id?: string;
  employeeProfileId: string;
  typeId: string;
  allocated: number;
  validityYear: number;
  description?: string | null;
}): Promise<ActionResult<AllocationListItem>> {
  try {
    await requirePermission("approveLeave");
    const parsed = upsertAllocationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

    const row = parsed.data.id
      ? await prisma.timeOffAllocation.update({
          where: { id: parsed.data.id },
          data: {
            employeeId: parsed.data.employeeProfileId,
            typeId: parsed.data.typeId,
            allocated: parsed.data.allocated,
            validityYear: parsed.data.validityYear,
            description: parsed.data.description?.trim() || null,
          },
          include: {
            employee: { select: { employeeId: true, fullName: true } },
            type: { select: { name: true } },
          },
        })
      : await prisma.timeOffAllocation.create({
          data: {
            employeeId: parsed.data.employeeProfileId,
            typeId: parsed.data.typeId,
            allocated: parsed.data.allocated,
            validityYear: parsed.data.validityYear,
            description: parsed.data.description?.trim() || null,
            status: "draft",
          },
          include: {
            employee: { select: { employeeId: true, fullName: true } },
            type: { select: { name: true } },
          },
        });

    revalidatePath("/admin/people/leave/allocations");
    return { ok: true, data: mapAllocation(row) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save allocation.") };
  }
}

export async function decideAllocationAction(input: {
  id: string;
  decision: "approved" | "refused";
}): Promise<ActionResult<AllocationListItem>> {
  try {
    await requirePermission("approveLeave");
    const row = await prisma.timeOffAllocation.update({
      where: { id: input.id },
      data: { status: input.decision },
      include: {
        employee: { select: { employeeId: true, fullName: true } },
        type: { select: { name: true } },
      },
    });
    revalidatePath("/admin/people/leave/allocations");
    return { ok: true, data: mapAllocation(row) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not update allocation.") };
  }
}
