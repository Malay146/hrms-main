"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth/server";
import { logger } from "@/lib/shared/logger";
import { firstZodError, loginSchema, changePasswordSchema, signUpSchema } from "@/lib/shared/validations";
import { homePath } from "@/lib/auth/permissions";
import { actionErrorMessage, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { allocateOrgSlug, nextEmployeeId } from "@/lib/people/employee-id";
import { bootstrapNewOrganization } from "@/lib/org/bootstrap";
import { kolkataParts } from "@/lib/shared/dates";
import type { ActionResult, Role } from "@/lib/shared/types";

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ role: Role; redirectTo: string }>> {
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

    const dbUser = await prisma.user.findUnique({
      where: { id: result.user.id },
      select: { role: true, mustChangePassword: true },
    });
    const role = (dbUser?.role ?? (result.user as { role?: Role }).role ?? "employee") as Role;
    logger.info("auth.login", { userId: result.user.id, role });
    return {
      ok: true,
      data: {
        role,
        redirectTo: dbUser?.mustChangePassword ? "/change-password" : homePath(role),
      },
    };
  } catch (error) {
    logger.warn("auth.login_failed", {
      email: parsed.data.email,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Invalid email or password." };
  }
}

export async function signUpOrganizationAction(input: {
  name: string;
  organizationName: string;
  organizationEmail: string;
  password: string;
  confirmPassword: string;
}): Promise<ActionResult<{ role: Role; redirectTo: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  const email = parsed.data.organizationEmail.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const existingSlugs = (await prisma.organization.findMany({ select: { slug: true } })).map(
    (row) => row.slug,
  );
  const slug = allocateOrgSlug(parsed.data.organizationName, existingSlugs);
  const year = kolkataParts().year;
  const employeeId = nextEmployeeId(slug, year, []);
  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();
  const userId = crypto.randomUUID();

  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: parsed.data.organizationName.trim(),
          email,
          slug,
        },
      });
      const { departmentId, scheduleId } = await bootstrapNewOrganization(tx, organization.id);
      await tx.user.create({
        data: {
          id: userId,
          name: parsed.data.name.trim(),
          email,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          role: "admin",
          mustChangePassword: false,
          accounts: {
            create: {
              id: crypto.randomUUID(),
              accountId: userId,
              providerId: "credential",
              issuer: "local:credential",
              password: passwordHash,
              createdAt: now,
              updatedAt: now,
            },
          },
          profile: {
            create: {
              organizationId: organization.id,
              employeeId,
              fullName: parsed.data.name.trim(),
              role: "admin",
              departmentId,
              jobTitle: "Administrator",
              status: "active",
              paidLeaveBalance: 20,
              employeeType: "full_time",
              scheduleId,
            },
          },
        },
      });
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { ok: false, error: "That email or organization slug is already in use." };
    }
    return { ok: false, error: actionErrorMessage(error, "Could not create the organization.") };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    logger.warn("auth.org_signup_signin_failed", {
      email,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: "Organization created. Sign in with the same email and password.",
    };
  }

  logger.info("auth.org_created", { userId, slug });
  return { ok: true, data: { role: "admin", redirectTo: "/admin" } };
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  try {
    const user = await requireUser();
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false },
    });
    logger.info("auth.password_changed", { userId: user.id });
    return { ok: true, data: { redirectTo: homePath(user.role) } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not change password.") };
  }
}

export async function signOutAction(): Promise<never> {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
    logger.info("auth.logout", {});
  } catch {
    // Session may already be gone; still send the user to login.
  }
  redirect("/login");
}
