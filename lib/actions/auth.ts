"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { orgSlugFromName, nextEmployeeId } from "@/lib/employee-id";
import { logger } from "@/lib/logger";
import { firstZodError, loginSchema, signUpSchema } from "@/lib/validations";
import { kolkataParts } from "@/lib/dates";
import type { ActionResult, Role } from "@/lib/types";

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ role: Role }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  try {
    const result = await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });

    const role = ((result.user as { role?: Role }).role ?? "employee") as Role;
    logger.info("auth.login", { userId: result.user.id, role });
    return { ok: true, data: { role } };
  } catch {
    return { ok: false, error: "Invalid email or password." };
  }
}

export async function signUpOrganizationAction(input: {
  name: string;
  organizationName: string;
  organizationEmail: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<{ role: Role }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return {
      ok: false,
      error: "This organization already has an admin. Ask them to create your account.",
    };
  }

  try {
    const signedUp = await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.organizationEmail,
        password: parsed.data.password,
      },
      headers: await headers(),
    });

    const slug = orgSlugFromName(parsed.data.organizationName);
    const year = kolkataParts().year;
    const organization = await prisma.organization.create({
      data: {
        name: parsed.data.organizationName,
        email: parsed.data.organizationEmail,
        slug,
      },
    });

    await prisma.user.update({
      where: { id: signedUp.user.id },
      data: { role: "admin", emailVerified: true },
    });

    await prisma.employeeProfile.create({
      data: {
        userId: signedUp.user.id,
        organizationId: organization.id,
        employeeId: nextEmployeeId(slug, year, []),
        fullName: parsed.data.name,
        role: "admin",
        department: "Human Resources",
        jobTitle: "HR Admin",
        status: "active",
        paidLeaveBalance: 20,
      },
    });

    logger.info("auth.signup", { userId: signedUp.user.id, role: "admin" });
    return { ok: true, data: { role: "admin" } };
  } catch (error) {
    logger.error("auth.signup_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, error: "Could not create the organization. Try a different email." };
  }
}

export async function signOutAction(): Promise<ActionResult> {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
    logger.info("auth.logout", {});
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Could not sign out." };
  }
}
