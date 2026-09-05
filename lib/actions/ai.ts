"use server";

import { prisma } from "@/lib/db";
import { buildAiSnapshot } from "@/lib/ai/build-snapshot";
import { addDaysToKey } from "@/lib/ai/metrics";
import { hasPermission } from "@/lib/permissions";
import { actionErrorMessage, requirePermission } from "@/lib/session";
import { dateFromKey, kolkataTodayKey, toDateKey, weekDayKeys } from "@/lib/dates";
import type { ActionResult, AiAnalyticsData, AiCopilotResult, AiInsightCard } from "@/lib/types";

const PERIOD_DAYS = 30;

export async function getAiAnalytics(periodDays = PERIOD_DAYS): Promise<ActionResult<AiAnalyticsData>> {
  try {
    const assembled = await assembleAiSnapshot(periodDays);
    return { ok: true, data: assembled.data };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load AI analytics.") };
  }
}

export async function assembleAiSnapshot(periodDays = PERIOD_DAYS, insights: AiInsightCard[] = []) {
  const user = await requirePermission("viewAiAnalytics");
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: user.id },
    select: { organizationId: true },
  });
  if (!profile) {
    throw new Error("No organization on this account.");
  }

  const orgId = profile.organizationId;
  const canPeople = hasPermission(user.role, "managePeople");
  const canPayroll = hasPermission(user.role, "viewPayrollAll");
  const today = kolkataTodayKey();
  const periodEnd = today;
  const periodStart = addDaysToKey(today, -(periodDays - 1));
  const lookbackStart = addDaysToKey(periodStart, -periodDays);

  const employees = await prisma.employeeProfile.findMany({
    where: { organizationId: orgId, role: "employee" },
    select: {
      id: true,
      userId: true,
      employeeId: true,
      fullName: true,
      department: true,
      status: true,
      paidLeaveBalance: true,
      bankAccount: true,
      wage: true,
      createdAt: true,
    },
  });

  const userIds = employees.map((row) => row.userId);
  const departmentByUser = new Map(employees.map((row) => [row.userId, row.department]));

  const [attendanceRows, leaveRows, paidPayrun, warningPayslips, paidCount] = await Promise.all([
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
          where: { userId: { in: userIds } },
          select: { userId: true, type: true, startDate: true, endDate: true, status: true },
        }),
    canPayroll
      ? prisma.payrun.findFirst({
          where: { organizationId: orgId, status: "paid" },
          orderBy: { periodEnd: "desc" },
          include: { payslips: { select: { net: true, warning: true } } },
        })
      : Promise.resolve(null),
    canPayroll
      ? prisma.payslip.count({
          where: {
            warning: { not: null },
            employee: { organizationId: orgId },
          },
        })
      : Promise.resolve(0),
    canPayroll
      ? prisma.payslip.count({
          where: { employee: { organizationId: orgId } },
        })
      : Promise.resolve(0),
  ]);

  let payrollNet: number | null = null;
  if (canPayroll) {
    if (paidPayrun) {
      payrollNet = paidPayrun.payslips.reduce((sum, slip) => sum + Number(slip.net), 0);
    } else {
      const legacy = await prisma.payroll.findMany({
        where: { userId: { in: userIds } },
        select: { netSalary: true },
      });
      payrollNet = legacy.reduce((sum, row) => sum + Number(row.netSalary), 0);
    }
  }

  const payrunWarningPct = paidCount === 0 ? 0 : (warningPayslips / paidCount) * 100;

  const weekKeys = weekDayKeys();
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyByDate = new Map<string, number>();
  for (const row of attendanceRows) {
    const key = toDateKey(row.date);
    if (!weekKeys.includes(key)) continue;
    if (row.status === "present" || row.status === "half_day") {
      weeklyByDate.set(key, (weeklyByDate.get(key) ?? 0) + 1);
    }
  }
  const weeklyAttendance = weekKeys.map((key, index) => ({
    day: weekLabels[index],
    attendance: weeklyByDate.get(key) ?? 0,
  }));

  return {
    user,
    canPeople,
    canPayroll,
    orgId,
    ...buildAiSnapshot({
      employees: employees.map((row) => ({
        ...row,
        wage: row.wage == null ? null : Number(row.wage),
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
        type: row.type,
        startDate: toDateKey(row.startDate),
        endDate: toDateKey(row.endDate),
        status: row.status,
        department: departmentByUser.get(row.userId) ?? "Unknown",
      })),
      payrollNet,
      payrunWarningPct,
      weeklyAttendance,
      periodStart,
      periodEnd,
      today,
      canPeople,
      canPayroll,
      aiEnabled: Boolean(process.env.OPENAI_API_KEY),
      insights,
    }),
  };
}

export async function generateAiInsights(): Promise<ActionResult<AiInsightCard[]>> {
  try {
    await requirePermission("viewAiAnalytics");
    return { ok: false, error: "AI provider is not configured." };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not generate insights.") };
  }
}

export async function askHrCopilot(question: string): Promise<ActionResult<AiCopilotResult>> {
  try {
    await requirePermission("viewAiAnalytics");
    if (!question.trim()) return { ok: false, error: "Enter a question." };
    return { ok: false, error: "AI provider is not configured." };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not answer.") };
  }
}
