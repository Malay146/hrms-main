"use server";

import { prisma } from "@/lib/db";
import { buildAiSnapshot } from "@/lib/ai/build-snapshot";
import { generateInsightCards, generateLeaveBrief, isAiConfigured, phraseCopilotAnswer } from "@/lib/ai/client";
import { classifyCopilotQuestion, COPILOT_NO_PAYROLL, COPILOT_REFUSAL } from "@/lib/ai/copilot";
import { mapInsightCards } from "@/lib/ai/insights";
import { addDaysToKey, leaveClashCount } from "@/lib/ai/metrics";
import { toModelSnapshot } from "@/lib/ai/sanitize";
import { hasPermission } from "@/lib/permissions";
import { actionErrorMessage, requirePermission } from "@/lib/session";
import { dateFromKey, inclusiveDayCount, kolkataTodayKey, toDateKey, weekDayKeys } from "@/lib/dates";
import { copilotQuestionSchema, firstZodError } from "@/lib/validations";
import type { ActionResult, AiAnalyticsData, AiCopilotResult, AiInsightCard, AiLeaveBrief } from "@/lib/types";

const PERIOD_DAYS = 30;
const INSIGHT_TTL_MS = 6 * 60 * 60 * 1000;

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

export async function getAiAnalytics(periodDays = PERIOD_DAYS): Promise<ActionResult<AiAnalyticsData>> {
  try {
    const assembled = await assembleAiSnapshot(periodDays);
    return { ok: true, data: assembled.data };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load AI analytics.") };
  }
}

export async function assembleAiSnapshot(periodDays = PERIOD_DAYS, insights?: AiInsightCard[]) {
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
      insights: insights ?? (await loadCachedInsights(orgId)),
    }),
  };
}

export async function generateAiInsights(): Promise<ActionResult<AiInsightCard[]>> {
  try {
    if (!isAiConfigured()) {
      return { ok: false, error: "AI provider is not configured." };
    }
    const assembled = await assembleAiSnapshot();
    const raw = await generateInsightCards(toModelSnapshot(assembled.modelInput));
    const cards = mapInsightCards({ insights: raw });
    if (cards.length === 0) {
      return { ok: false, error: "The model did not return usable insights." };
    }
    const expiresAt = new Date(Date.now() + INSIGHT_TTL_MS);
    await prisma.aiInsight.deleteMany({ where: { organizationId: assembled.orgId } });
    await prisma.aiInsight.createMany({
      data: cards.map((card) => ({
        organizationId: assembled.orgId,
        severity: card.severity,
        title: card.title,
        body: card.body,
        action: card.action,
        href: card.href,
        expiresAt,
      })),
    });
    return { ok: true, data: cards };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not generate insights.") };
  }
}

export async function askHrCopilot(question: string): Promise<ActionResult<AiCopilotResult>> {
  try {
    const parsed = copilotQuestionSchema.safeParse({ question });
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }
    const intent = classifyCopilotQuestion(parsed.data.question);
    if (intent === "refuse") {
      return { ok: true, data: { answer: COPILOT_REFUSAL, source: "Refused out-of-scope request" } };
    }

    const assembled = await assembleAiSnapshot();
    const today = kolkataTodayKey();
    const facts: string[] = [];
    let source = "Workforce metrics for the current period";

    if (intent === "leave_today") {
      const onLeave = await prisma.leaveRequest.findMany({
        where: {
          status: "approved",
          startDate: { lte: dateFromKey(today) },
          endDate: { gte: dateFromKey(today) },
          user: { profile: { organizationId: assembled.orgId } },
        },
        include: { user: { select: { profile: { select: { fullName: true, department: true } } } } },
      });
      const names = assembled.canPeople
        ? onLeave.map((row) => row.user.profile?.fullName ?? "Employee")
        : [];
      facts.push(`${onLeave.length} approved leave(s) overlap today.`);
      if (names.length) facts.push(`People: ${names.join(", ")}.`);
      source = `${onLeave.length} approved leaves overlapping today`;
    }

    if (intent === "attendance") {
      facts.push(`Org attendance rate is ${assembled.data.attendancePct}% for ${assembled.data.periodLabel}.`);
      source = `Attendance rate ${assembled.data.attendancePct}%`;
    }

    if (intent === "pending_leave") {
      facts.push(`${assembled.data.pendingApprovals} leave request(s) are pending.`);
      source = `${assembled.data.pendingApprovals} pending leave requests`;
    }

    if (intent === "payroll") {
      if (!assembled.canPayroll) {
        return { ok: true, data: { answer: COPILOT_NO_PAYROLL, source: "Permission check" } };
      }
      facts.push(
        assembled.data.payrollNet == null
          ? "No paid payrun total is available."
          : `Latest paid net total is ${assembled.data.payrollNet}.`,
      );
      source = "Latest paid payrun net total";
    }

    if (intent === "general") {
      facts.push(
        `Health score ${assembled.data.health.score} (${assembled.data.health.band}). Attendance ${assembled.data.attendancePct}%. Pending leave ${assembled.data.pendingApprovals}. Approved leave days ${assembled.data.leaveDaysApproved}.`,
      );
    }

    const factText = facts.join(" ");
    if (isAiConfigured()) {
      const answer = await phraseCopilotAnswer({
        question: parsed.data.question,
        facts: factText,
        snapshotJson: toModelSnapshot(assembled.modelInput),
      });
      return { ok: true, data: { answer, source } };
    }
    return { ok: true, data: { answer: factText || COPILOT_REFUSAL, source } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not answer.") };
  }
}

export async function summarizeLeaveForApprover(leaveId: string): Promise<ActionResult<AiLeaveBrief>> {
  try {
    await requirePermission("approveLeave");
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            profile: {
              select: {
                organizationId: true,
                department: true,
                paidLeaveBalance: true,
                fullName: true,
              },
            },
          },
        },
      },
    });
    if (!leave?.user.profile) {
      return { ok: false, error: "Leave request not found." };
    }
    const orgId = leave.user.profile.organizationId;
    const department = leave.user.profile.department;
    const start = toDateKey(leave.startDate);
    const end = toDateKey(leave.endDate);
    const days = inclusiveDayCount(start, end);

    const peers = await prisma.leaveRequest.findMany({
      where: {
        id: { not: leave.id },
        status: { in: ["pending", "approved"] },
        user: { profile: { organizationId: orgId, department } },
      },
      select: { startDate: true, endDate: true },
    });
    const clashCount = leaveClashCount(
      [{ department, start, end }, ...peers.map((row) => ({
        department,
        start: toDateKey(row.startDate),
        end: toDateKey(row.endDate),
      }))],
    );

    const payload = {
      type: leave.type,
      days,
      remarks: leave.remarks.slice(0, 280),
      remainingPaidBalance: leave.user.profile.paidLeaveBalance,
      department,
      departmentClashCount: clashCount,
      status: leave.status,
    };

    let bullets: string[];
    let suggestion: AiLeaveBrief["suggestion"];
    if (isAiConfigured()) {
      const generated = await generateLeaveBrief(payload);
      bullets = generated.bullets;
      suggestion = generated.suggestion;
    } else {
      suggestion = clashCount > 0 || (leave.type === "paid" && leave.user.profile.paidLeaveBalance < days)
        ? "review"
        : "approve";
      bullets = [
        `${leave.type} leave for ${days} day(s): ${leave.remarks.slice(0, 160)}`,
        `${clashCount} overlapping request(s) in ${department}.`,
        `Paid balance remaining: ${leave.user.profile.paidLeaveBalance} day(s).`,
      ];
    }

    return {
      ok: true,
      data: { leaveId: leave.id, bullets, suggestion, clashCount },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not summarize this leave request.") };
  }
}
