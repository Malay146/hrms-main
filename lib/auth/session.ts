import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/shared/types";
import type { Permission } from "@/lib/auth/permissions";
import { hasPermission, homePath, isStaffRole } from "@/lib/auth/permissions";

export class AuthError extends Error {
  constructor(message = "You need to sign in.") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
});

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session?.user) return null;

  const profilePromise = prisma.employeeProfile.findUnique({
    where: { userId: session.user.id },
    include: { department: { select: { name: true } } },
  });
  const dbUserPromise = prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, mustChangePassword: true },
  });
  const [profile, dbUser] = await Promise.all([profilePromise, dbUserPromise]);

  const role = (dbUser?.role ?? session.user.role ?? profile?.role ?? "employee") as Role;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role,
    mustChangePassword: Boolean(dbUser?.mustChangePassword),
    employeeId: profile?.employeeId ?? null,
    fullName: profile?.fullName ?? session.user.name,
    department: profile?.department?.name ?? null,
    jobTitle: profile?.jobTitle ?? null,
    phone: profile?.phone ?? null,
    status: profile?.status ?? null,
    paidLeaveBalance: profile?.paidLeaveBalance ?? null,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError();
  }
  return user;
}

export async function requireRole(role: Role) {
  const user = await requireUser();
  if (user.role !== role) {
    throw new ForbiddenError();
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError();
  }
  return user;
}

export async function requirePageRole(role: Role) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  if (user.role !== role) {
    redirect(homePath(user.role));
  }
  return user;
}

export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  return user;
}

export async function requireStaffPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.mustChangePassword) {
    redirect("/change-password");
  }
  if (!isStaffRole(user.role)) {
    redirect("/employee");
  }
  return user;
}

export { homePath, isStaffRole };

export function actionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AuthError) return "Your session expired. Please sign in again.";
  if (error instanceof ForbiddenError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
