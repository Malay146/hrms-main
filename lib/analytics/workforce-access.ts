import { hasPermission } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { workforceVisibleEmployeeIds } from "@/lib/analytics/workforce";
import { prisma } from "@/lib/db";

export async function getWorkforceActor() {
  const user = await requireUser();
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      organizationId: true,
      reports: { select: { id: true } },
    },
  });
  if (!profile) throw new Error("No employee profile is linked to this account.");

  return {
    userId: user.id,
    role: user.role,
    profileId: profile.id,
    organizationId: profile.organizationId,
    directReportIds: profile.reports.map((report) => report.id),
    isHr: hasPermission(user.role, "viewAiAnalytics"),
  };
}

export type WorkforceActor = Awaited<ReturnType<typeof getWorkforceActor>>;

export function visibleEmployeeIds(actor: WorkforceActor): string[] | undefined {
  return workforceVisibleEmployeeIds(actor.isHr, actor.profileId, actor.directReportIds);
}

export function canViewWorkforceProfile(actor: WorkforceActor, employeeId: string) {
  return actor.isHr || employeeId === actor.profileId || actor.directReportIds.includes(employeeId);
}
