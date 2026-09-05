"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requireUser } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";

const profileSchema = z.object({
  phone: z.string().trim().max(40).optional(),
});

export async function updateMyProfileAction(input: {
  phone?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      return { ok: false, error: "Profile not found." };
    }

    await prisma.employeeProfile.update({
      where: { userId: user.id },
      data: { phone: parsed.data.phone || null },
    });
    revalidatePath("/employee/profile");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not update profile.") };
  }
}
