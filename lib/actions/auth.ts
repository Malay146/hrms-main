"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { logger } from "@/lib/shared/logger";
import {
  firstZodError,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/shared/validations";
import { homePath } from "@/lib/auth/permissions";
import { actionErrorMessage, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { ActionResult, Role } from "@/lib/shared/types";

function appOrigin() {
  return (
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

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

export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<ActionResult<{ message: string }>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  const message =
    "If an account exists for that email, we sent a password reset link. Check your inbox.";

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email.trim().toLowerCase(),
        redirectTo: `${appOrigin()}/reset-password`,
      },
      headers: await headers(),
    });
    logger.info("auth.password_reset_requested", { email: parsed.data.email });
    return { ok: true, data: { message } };
  } catch (error) {
    logger.warn("auth.password_reset_request_failed", {
      email: parsed.data.email,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: true, data: { message } };
  }
}

export async function resetPasswordAction(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }

  try {
    await auth.api.resetPassword({
      body: {
        newPassword: parsed.data.newPassword,
        token: parsed.data.token,
      },
    });
    return { ok: true, data: { redirectTo: "/login?reset=1" } };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(
        error,
        "Could not reset password. The link may be invalid or expired.",
      ),
    };
  }
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
