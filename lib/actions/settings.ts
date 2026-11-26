"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import {
  actionErrorMessage,
  getSession,
  requireOrganization,
  requirePermission,
  requireUser,
} from "@/lib/auth/session";
import { logger } from "@/lib/shared/logger";
import { firstZodError, organizationSettingsSchema } from "@/lib/shared/validations";
import type { ActionResult } from "@/lib/shared/types";

export type OrganizationSettings = {
  name: string;
  email: string;
  code: string;
  createdAt: string;
  employeeCount: number;
  activeEmployeeCount: number;
  departmentCount: number;
  /** Payroll and dates are computed in INR / Asia/Kolkata throughout the app. */
  currency: "INR";
  timezone: "Asia/Kolkata";
  canEdit: boolean;
};

export type AccountSession = {
  id: string;
  current: boolean;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};

export async function getOrganizationSettings(): Promise<ActionResult<OrganizationSettings>> {
  try {
    const user = await requireOrganization();
    const [org, employeeCount, activeEmployeeCount, departmentCount] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
        select: { name: true, email: true, slug: true, createdAt: true },
      }),
      prisma.employeeProfile.count({ where: { organizationId: user.organizationId } }),
      prisma.employeeProfile.count({
        where: { organizationId: user.organizationId, status: "active" },
      }),
      prisma.department.count({ where: { organizationId: user.organizationId } }),
    ]);
    return {
      ok: true,
      data: {
        name: org.name,
        email: org.email,
        code: org.slug,
        createdAt: org.createdAt.toISOString(),
        employeeCount,
        activeEmployeeCount,
        departmentCount,
        currency: "INR",
        timezone: "Asia/Kolkata",
        canEdit: hasPermission(user.role, "adminExtras"),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load organization settings.") };
  }
}

export async function updateOrganizationAction(input: {
  name: string;
  email: string;
}): Promise<ActionResult<{ name: string; email: string }>> {
  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }
  try {
    const user = await requirePermission("adminExtras");
    if (!user.organizationId) {
      return { ok: false, error: "Your account is not linked to an organization." };
    }
    const org = await prisma.organization.update({
      where: { id: user.organizationId },
      data: { name: parsed.data.name, email: parsed.data.email },
      select: { name: true, email: true },
    });
    logger.info("settings.organization_updated", {
      organizationId: user.organizationId,
      adminId: user.id,
    });
    revalidatePath("/admin", "layout");
    return { ok: true, data: org };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save organization settings.") };
  }
}

function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /curl|python|node/i.test(userAgent)
            ? "API client"
            : "Browser";
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return os ? `${browser} on ${os}` : browser;
}

export async function listMySessions(): Promise<ActionResult<AccountSession[]>> {
  try {
    const user = await requireUser();
    const current = await getSession();
    const rows = await prisma.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        current: row.id === current?.session.id,
        device: describeDevice(row.userAgent),
        ipAddress: row.ipAddress || null,
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: row.updatedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load sessions.") };
  }
}

/** Sign out one of your own sessions (never the one making the request). */
export async function revokeSessionAction(sessionId: string): Promise<ActionResult<{ revoked: number }>> {
  try {
    const user = await requireUser();
    const current = await getSession();
    if (sessionId === current?.session.id) {
      return { ok: false, error: "Use Log out to end your current session." };
    }
    const result = await prisma.session.deleteMany({
      where: { id: sessionId, userId: user.id },
    });
    if (result.count === 0) {
      return { ok: false, error: "That session no longer exists." };
    }
    logger.info("settings.session_revoked", { userId: user.id });
    return { ok: true, data: { revoked: result.count } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not sign out that session.") };
  }
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<{ revoked: number }>> {
  try {
    const user = await requireUser();
    const current = await getSession();
    const result = await prisma.session.deleteMany({
      where: { userId: user.id, ...(current ? { id: { not: current.session.id } } : {}) },
    });
    logger.info("settings.sessions_revoked", { userId: user.id, count: result.count });
    return { ok: true, data: { revoked: result.count } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not sign out other sessions.") };
  }
}
