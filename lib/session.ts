import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role, SessionUser } from "@/lib/types";

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

  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: session.user.id },
  });

  const role = (session.user.role ?? profile?.role ?? "employee") as Role;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role,
    employeeId: profile?.employeeId ?? null,
    fullName: profile?.fullName ?? session.user.name,
    department: profile?.department ?? null,
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

export async function requirePageRole(role: Role) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== role) {
    redirect(user.role === "admin" ? "/admin" : "/employee");
  }
  return user;
}

export function actionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AuthError) return "Your session expired. Please sign in again.";
  if (error instanceof ForbiddenError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
