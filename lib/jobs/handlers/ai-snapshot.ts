import { prisma } from "@/lib/db";
import { buildAiSnapshot } from "@/lib/ai/build-snapshot";
import { mapInsightCards } from "@/lib/ai/insights";
import { isAiConfigured } from "@/lib/ai/client";
import { addDaysToKey } from "@/lib/ai/metrics";
import { dateFromKey, kolkataTodayKey, toDateKey, weekDayKeys } from "@/lib/shared/dates";
import { leaveTypeFromCode } from "@/lib/shared/mappers";
import type { AiAnalyticsData, AiInsightCard } from "@/lib/shared/types";

async function loadCachedInsights(organizationId: string): Promise<AiInsightCard[]> {
  const rows = await prisma.aiInsight.findMany({
    where: { organizationId, expiresAt: { gt: new Date() } },
    orderBy: { generatedAt: "desc" },
    take: 6,
  });
  return rows.map((row) => ({
    id: row.id,
    severity: row.severity as AiInsightCard["severity"],
    title: row.title,
    body: row.body,
    action: row.action,
    href: row.href ?? undefined,
  }));
}

/** Heavy rebuild — only for background jobs / bootstrap, never on casual GET. */
export async function buildOrgAiAnalyticsData(
  organizationId: string,
  periodDays = 30,
  options?: { canPeople?: boolean; canPayroll?: boolean },
): Promise<AiAnalyticsData> {
  const canPeople = options?.canPeople ?? true;
  const canPayroll = options?.canPayroll ?? true;
  const today = kolkataTodayKey();
  const periodEnd = today;
  const periodStart = addDaysToKey(today, -(periodDays - 1));
  const lookbackStart = addDaysToKey(periodStart, -periodDays);

  const employees = await prisma.employeeProfile.findMany({
    where: { organizationId, role: "employee" },
    select: {
      id: true,
      userId: true,
      employeeId: true,
      fullName: true,
      department: { select: { name: true } },
      status: true,
      paidLeaveBalance: true,
      bankAccount: true,
      wage: true,
      createdAt: true,
    },
  });

  const userIds = employees.map((row) => row.userId);
  const departmentByUser = new Map(employees.map((row) => [row.userId, row.department.name]));

  const [attendanceRows, leaveRows, paidPayrun, warningPayslips, paidCount, reviewAgg, statusGroups] =
    await Promise.all([
      userIds.length === 0
        ? Promise.resolve([])
        : prisma.attendance.findMany({
            where: {
              userId: { in: userIds },
              date: { gte: dateFromKey(lookbackStart), lte: dateFromKey(periodEnd) },
            },
            select: { userId: true, date: true, status: true, checkIn: true, checkOut: true },
          }),
      userIds.length === 0
        ? Promise.resolve([])
        : prisma.leaveRequest.findMany({
            where: {
              userId: { in: userIds },
              startDate: { lte: dateFromKey(periodEnd) },
              endDate: { gte: dateFromKey(lookbackStart) },
            },
            select: {
              userId: true,
              type: { select: { code: true } },
              startDate: true,
              endDate: true,
              status: true,
            },
          }),
      canPayroll
        ? prisma.payrun.findFirst({
            where: { organizationId, status: "paid" },
            orderBy: { periodEnd: "desc" },
            include: { payslips: { select: { net: true } } },
          })
        : Promise.resolve(null),
      canPayroll
        ? prisma.payslip.count({
            where: { warning: { not: null }, employee: { organizationId } },
          })
        : Promise.resolve(0),
      canPayroll
        ? prisma.payslip.count({ where: { employee: { organizationId } } })
        : Promise.resolve(0),
      prisma.performanceReview.aggregate({
        where: {
          cycle: { organizationId },
          overallRating: { not: null },
          status: { not: "draft" },
        },
        _avg: { overallRating: true },
      }),
      prisma.performanceReview.groupBy({
        by: ["status"],
        where: { cycle: { organizationId } },
        _count: { _all: true },
      }),
    ]);

  const payrollNet = paidPayrun
    ? paidPayrun.payslips.reduce((sum, slip) => sum + Number(slip.net), 0)
    : null;
  const payrunWarningPct = paidCount === 0 ? 0 : (warningPayslips / paidCount) * 100;
  const statusMap = new Map(statusGroups.map((row) => [row.status, row._count._all]));
  const performance = {
    avgRating:
      reviewAgg._avg.overallRating == null
        ? null
        : Math.round(Number(reviewAgg._avg.overallRating) * 10) / 10,
    pendingReviews: statusMap.get("draft") ?? 0,
    submittedReviews: statusMap.get("submitted") ?? 0,
  };

  const weekKeys = weekDayKeys();
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyByDate = new Map<string, number>();
  for (const row of attendanceRows) {
    const key = toDateKey(row.date);
    if (key >= weekKeys[0] && key <= weekKeys[6] && (row.status === "present" || row.status === "half_day")) {
      weeklyByDate.set(key, (weeklyByDate.get(key) ?? 0) + 1);
    }
  }

  const insights = await loadCachedInsights(organizationId);
  const snapshotInput = {
    employees: employees.map((row) => ({
      id: row.id,
      userId: row.userId,
      employeeId: row.employeeId,
      fullName: row.fullName,
      department: row.department.name,
      status: row.status,
      paidLeaveBalance: Number(row.paidLeaveBalance ?? 0),
      bankAccount: row.bankAccount,
      wage: row.wage == null ? null : Number(row.wage),
      createdAt: row.createdAt,
    })),
    attendance: attendanceRows.map((row) => ({
      userId: row.userId,
      date: toDateKey(row.date),
      status: row.status,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
    })),
    leaves: leaveRows.map((row) => ({
      userId: row.userId,
      type: leaveTypeFromCode(row.type.code),
      startDate: toDateKey(row.startDate),
      endDate: toDateKey(row.endDate),
      status: row.status,
      department: departmentByUser.get(row.userId) ?? "—",
    })),
    payrollNet,
    payrunWarningPct,
    weeklyAttendance: weekKeys.map((key, index) => ({
      day: weekLabels[index],
      attendance: weeklyByDate.get(key) ?? 0,
    })),
    periodStart,
    periodEnd,
    today,
    canPeople,
    canPayroll,
    aiEnabled: isAiConfigured(),
    insights,
    performance,
  } as const;

  const built = buildAiSnapshot({
    ...snapshotInput,
    insights:
      insights.length > 0
        ? insights
        : mapInsightCards([]),
  });
  return built.data;
}

export async function runAiSnapshotRebuildJob(
  organizationId: string,
  jobId: string,
  periodDays = 30,
) {
  const data = await buildOrgAiAnalyticsData(organizationId, periodDays);
  await prisma.orgMetricsSnapshot.create({
    data: {
      organizationId,
      kind: "ai_analytics",
      payload: data,
      generatedAt: new Date(),
      sourceJobId: jobId,
    },
  });
  return { organizationId, kind: "ai_analytics", generatedAt: new Date().toISOString() };
}

export async function readLatestAiSnapshot(
  organizationId: string,
): Promise<{ data: AiAnalyticsData; generatedAt: Date } | null> {
  const row = await prisma.orgMetricsSnapshot.findFirst({
    where: { organizationId, kind: "ai_analytics" },
    orderBy: { generatedAt: "desc" },
  });
  if (!row) return null;
  return { data: row.payload as AiAnalyticsData, generatedAt: row.generatedAt };
}
