"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { logger } from "@/lib/shared/logger";
import { firstZodError, loginSchema, changePasswordSchema } from "@/lib/shared/validations";
import { homePath } from "@/lib/auth/permissions";
import { actionErrorMessage, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
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

export async function signUpOrganizationAction(): Promise<ActionResult<{ role: Role }>> {
  return {
    ok: false,
    error: "Public sign-up is closed. Ask an administrator to create your account.",
  };
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
