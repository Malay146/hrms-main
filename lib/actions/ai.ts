"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { buildAiSnapshot } from "@/lib/ai/build-snapshot";
import {
  generateInsightCards,
  generateLeaveBrief,
  isAiConfigured,
  phraseAssistantChat,
  planCopilotTurn,
} from "@/lib/ai/client";
import { executeAssistantLookup, executeAssistantPlan } from "@/lib/ai/assistant-execute";
import {
  chatReply,
  classifyCopilotQuestion,
  confirmationPrompt,
  conversationTitleFromQuestion,
  COPILOT_REFUSAL,
  isCancel,
  isConfirm,
  isSmallTalk,
  lookupForCopilotIntent,
  parsePendingAction,
  pendingReminder,
  planAssistantTurn,
  summarizePendingAction,
} from "@/lib/ai/copilot";
import { mapInsightCards } from "@/lib/ai/insights";
import { addDaysToKey, leaveClashCount } from "@/lib/ai/metrics";
import { toModelSnapshot } from "@/lib/ai/sanitize";
import { hasPermission } from "@/lib/auth/permissions";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { dateFromKey, inclusiveDayCount, kolkataTodayKey, toDateKey, weekDayKeys } from "@/lib/shared/dates";
import { leaveTypeFromCode } from "@/lib/shared/mappers";
import { enforceRateLimits, RATE_LIMITS, userRateKey } from "@/lib/shared/rate-limit";
import { copilotConversationIdSchema, copilotQuestionSchema, firstZodError } from "@/lib/shared/validations";
import type {
  ActionResult,
  AiAnalyticsData,
  AiCopilotResult,
  AiInsightCard,
  AiLeaveBrief,
  CopilotConversationSummary,
  CopilotHistoryItem,
} from "@/lib/shared/types";

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
    const user = await requirePermission("viewAiAnalytics");
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) return { ok: false, error: "No organization on this account." };

    const { readLatestAiSnapshot, runAiSnapshotRebuildJob } = await import(
      "@/lib/jobs/handlers/ai-snapshot"
    );
    const { enqueueAndRun } = await import("@/lib/jobs/queue");

    const cached = await readLatestAiSnapshot(profile.organizationId);
    const staleMs = 6 * 60 * 60 * 1000;
    const isFresh =
      cached && Date.now() - cached.generatedAt.getTime() < staleMs;

    if (isFresh && cached) {
      return { ok: true, data: cached.data };
    }

    // Bootstrap or refresh via job (processed inline for single-node DX).
    await enqueueAndRun({
      organizationId: profile.organizationId,
      type: "ai_snapshot_rebuild",
      payload: { periodDays },
      createdByUserId: user.id,
    });

    const after = await readLatestAiSnapshot(profile.organizationId);
    if (after) return { ok: true, data: after.data };

    // Last resort bootstrap without waiting on claim races
    const job = await prisma.backgroundJob.create({
      data: {
        organizationId: profile.organizationId,
        type: "ai_snapshot_rebuild",
        status: "running",
        payload: { periodDays },
        createdByUserId: user.id,
        lockedAt: new Date(),
      },
    });
    await runAiSnapshotRebuildJob(profile.organizationId, job.id, periodDays);
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: "succeeded", finishedAt: new Date() },
    });
    const boot = await readLatestAiSnapshot(profile.organizationId);
    if (!boot) return { ok: false, error: "Could not build AI analytics snapshot." };
    return { ok: true, data: boot.data };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load AI analytics.") };
  }
}

export async function refreshAiAnalyticsAction(
  periodDays = PERIOD_DAYS,
): Promise<ActionResult<{ jobId: string; generatedAt?: string }>> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) return { ok: false, error: "No organization on this account." };
    const { enqueueAndRun } = await import("@/lib/jobs/queue");
    const job = await enqueueAndRun({
      organizationId: profile.organizationId,
      type: "ai_snapshot_rebuild",
      payload: { periodDays },
      createdByUserId: user.id,
    });
    const { readLatestAiSnapshot } = await import("@/lib/jobs/handlers/ai-snapshot");
    const snap = await readLatestAiSnapshot(profile.organizationId);
    revalidatePath("/admin/analytics");
    return {
      ok: true,
      data: {
        jobId: job.id,
        generatedAt: snap?.generatedAt.toISOString(),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not refresh AI analytics.") };
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

  const [attendanceRows, leaveRows, paidPayrun, warningPayslips, paidCount, reviewRows] = await Promise.all([
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
    prisma.performanceReview.findMany({
      where: { cycle: { organizationId: orgId } },
      select: { overallRating: true, status: true },
    }),
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

  const rated = reviewRows.filter((row) => row.overallRating != null && row.status !== "draft");
  const performance = {
    avgRating:
      rated.length === 0
        ? null
        : Math.round((rated.reduce((sum, row) => sum + Number(row.overallRating), 0) / rated.length) * 10) / 10,
    pendingReviews: reviewRows.filter((row) => row.status === "draft").length,
    submittedReviews: reviewRows.filter((row) => row.status === "submitted").length,
  };

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
        department: row.department.name,
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
        type: leaveTypeFromCode(row.type.code),
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
      performance,
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

async function persistCopilotTurn(
  userId: string,
  conversationId: string,
  question: string,
  result: Pick<AiCopilotResult, "answer" | "source">,
) {
  await prisma.copilotMessage.createMany({
    data: [
      { userId, conversationId, role: "user", body: question },
      { userId, conversationId, role: "assistant", body: result.answer, source: result.source },
    ],
  });
  await prisma.copilotConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

async function loadPending(userId: string, conversationId: string) {
  const row = await prisma.copilotConversation.findFirst({
    where: { id: conversationId, userId },
    select: { pendingAction: true },
  });
  return parsePendingAction(row?.pendingAction);
}

async function clearPending(conversationId: string) {
  await prisma.copilotConversation.update({
    where: { id: conversationId },
    data: { pendingAction: Prisma.DbNull },
  });
}

async function resolveConversation(userId: string, conversationId: string | null | undefined, question: string) {
  if (conversationId) {
    const existing = await prisma.copilotConversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }
  const created = await prisma.copilotConversation.create({
    data: {
      userId,
      title: conversationTitleFromQuestion(question),
    },
    select: { id: true },
  });
  return created.id;
}

function mapHistoryItem(row: { id: string; role: string; body: string; source: string | null; createdAt: Date }): CopilotHistoryItem {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    body: row.body,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function askHrCopilot(
  question: string,
  conversationId?: string | null,
): Promise<ActionResult<AiCopilotResult>> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    const copilotLimited = await enforceRateLimits([
      { key: userRateKey("copilot", user.id), ...RATE_LIMITS.copilotUser },
    ]);
    if (copilotLimited) return { ok: false, error: copilotLimited };

    const parsed = copilotQuestionSchema.safeParse({ question, conversationId });
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const asked = parsed.data.question;
    const threadId = await resolveConversation(user.id, parsed.data.conversationId, asked);
    const recent = await prisma.copilotMessage.findMany({
      where: { conversationId: threadId, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { role: true, body: true },
    });
    const history = recent.reverse().map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      body: row.body,
    }));

    const finish = async (
      payload: Omit<AiCopilotResult, "conversationId" | "needsConfirmation" | "confirmationSummary"> & {
        needsConfirmation?: boolean;
        confirmationSummary?: string | null;
      },
    ) => {
      const data: AiCopilotResult = {
        needsConfirmation: false,
        confirmationSummary: null,
        ...payload,
        conversationId: threadId,
      };
      await persistCopilotTurn(user.id, threadId, asked, data);
      return { ok: true as const, data };
    };

    const pending = await loadPending(user.id, threadId);
    const heuristic = planAssistantTurn(asked, history);

    if (pending && isCancel(asked)) {
      await clearPending(threadId);
      return finish({
        answer: "Okay — I cancelled that change. Nothing was saved.",
        source: "HR assistant",
        acted: false,
      });
    }
    if (pending && isConfirm(asked)) {
      await clearPending(threadId);
      const executed = await executeAssistantPlan(user, { kind: "act", tool: pending.tool, args: pending.args });
      const acted = /^(Created|Updated|Deleted|Renamed|Attendance|approved|rejected|Applied|Clock)/i.test(executed.source);
      return finish({ answer: executed.answer, source: executed.source, acted });
    }

    async function applyPlan(plan: typeof heuristic) {
      if (plan.kind === "refuse") {
        return finish({ answer: plan.answer, source: "Refused out-of-scope request", acted: false });
      }
      if (plan.kind === "clarify") {
        return finish({ answer: plan.answer, source: "Need more detail", acted: false });
      }
      if (plan.kind === "lookup") {
        const executed = await executeAssistantLookup(user, plan);
        return finish({ answer: executed.answer, source: executed.source, acted: false });
      }
      if (plan.kind === "act") {
        if (isConfirm(asked)) {
          const executed = await executeAssistantPlan(user, plan);
          const acted = /^(Created|Updated|Deleted|Renamed|Attendance|approved|rejected|Applied|Clock)/i.test(executed.source);
          return finish({ answer: executed.answer, source: executed.source, acted });
        }
        const summary = summarizePendingAction(plan.tool, plan.args);
        await prisma.copilotConversation.update({
          where: { id: threadId },
          data: { pendingAction: { tool: plan.tool, args: plan.args, summary } },
        });
        return finish({
          answer: confirmationPrompt(summary),
          source: "Needs your confirmation",
          acted: false,
          needsConfirmation: true,
          confirmationSummary: summary,
        });
      }
      return null;
    }

    if (pending && heuristic.kind !== "act" && heuristic.kind !== "lookup" && heuristic.kind !== "refuse") {
      return finish({
        answer: pendingReminder(pending.summary),
        source: "Needs your confirmation",
        acted: false,
        needsConfirmation: true,
        confirmationSummary: pending.summary,
      });
    }
    if (pending && heuristic.kind === "act") {
      await clearPending(threadId);
    }
    if (pending && heuristic.kind === "lookup") {
      await clearPending(threadId);
    }

    if (heuristic.kind === "act" || heuristic.kind === "lookup" || heuristic.kind === "refuse" || heuristic.kind === "clarify") {
      const handled = await applyPlan(heuristic);
      if (handled) return handled;
    }

    const plan = isAiConfigured()
      ? await planCopilotTurn({ question: asked, history })
      : heuristic;

    const handled = await applyPlan(plan);
    if (handled) return handled;

    const firstName = user.fullName.split(" ")[0] || "there";
    const intent = classifyCopilotQuestion(asked);
    if (intent === "refuse") {
      return finish({ answer: COPILOT_REFUSAL, source: "Refused out-of-scope request", acted: false });
    }
    if (plan.kind === "answer") {
      const tool = lookupForCopilotIntent(intent);
      if (tool) {
        const fromSql = await applyPlan({ kind: "lookup", tool, args: {} });
        if (fromSql) return fromSql;
      }
    }
    if (plan.kind === "chat" || intent === "chat") {
      const recentCreate = history.some((turn) => /(?:add|create|make).{0,40}departments?/i.test(turn.body));
      const alreadyCreated = history.some(
        (turn) => turn.role === "assistant" && /Created department/i.test(turn.body),
      );
      if (recentCreate && !alreadyCreated && !isSmallTalk(asked)) {
        return finish({
          answer:
            "I have not saved a department yet. Say it like “create CMS department”, then confirm. A name is enough.",
          source: "HR assistant",
          acted: false,
        });
      }
      const answer = isAiConfigured()
        ? await phraseAssistantChat({
            question: asked,
            firstName,
            history,
          })
        : chatReply(firstName, asked);
      return finish({ answer, source: "HR assistant", acted: false });
    }

    const fallbackLookup = lookupForCopilotIntent(intent);
    if (fallbackLookup) {
      const fromSql = await applyPlan({ kind: "lookup", tool: fallbackLookup, args: {} });
      if (fromSql) return fromSql;
    }

    const answer = isAiConfigured()
      ? await phraseAssistantChat({ question: asked, firstName, history })
      : chatReply(firstName, asked);
    return finish({ answer, source: "HR assistant", acted: false });
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not answer.") };
  }
}

export async function listCopilotConversations(): Promise<ActionResult<CopilotConversationSummary[]>> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    const rows = await prisma.copilotConversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true },
        },
      },
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updatedAt.toISOString(),
        preview: row.messages[0]?.body ?? "",
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load chat history.") };
  }
}

export async function listCopilotHistory(conversationId?: string | null): Promise<
  ActionResult<{ conversationId: string | null; messages: CopilotHistoryItem[]; pendingSummary: string | null }>
> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    let threadId = conversationId ?? null;
    if (!threadId) {
      const latest = await prisma.copilotConversation.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      threadId = latest?.id ?? null;
    }
    if (!threadId) return { ok: true, data: { conversationId: null, messages: [], pendingSummary: null } };
    const owned = await prisma.copilotConversation.findFirst({
      where: { id: threadId, userId: user.id },
      select: { id: true, pendingAction: true },
    });
    if (!owned) return { ok: false, error: "Chat not found." };
    const rows = await prisma.copilotMessage.findMany({
      where: { conversationId: threadId, userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return {
      ok: true,
      data: {
        conversationId: threadId,
        messages: rows.map(mapHistoryItem),
        pendingSummary: parsePendingAction(owned.pendingAction)?.summary ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load chat history.") };
  }
}

export async function deleteCopilotConversationAction(
  conversationId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    const parsed = copilotConversationIdSchema.safeParse({ conversationId });
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }
    const owned = await prisma.copilotConversation.findFirst({
      where: { id: parsed.data.conversationId, userId: user.id },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Chat not found." };
    await prisma.copilotConversation.delete({ where: { id: owned.id } });
    return { ok: true, data: { conversationId: owned.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete chat.") };
  }
}

export async function clearCopilotHistoryAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    const result = await prisma.copilotConversation.deleteMany({ where: { userId: user.id } });
    return { ok: true, data: { count: result.count } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not clear chat history.") };
  }
}

export async function summarizeLeaveForApprover(leaveId: string): Promise<ActionResult<AiLeaveBrief>> {
  try {
    await requirePermission("approveLeave");
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        type: { select: { code: true } },
        user: {
          select: {
            profile: {
              select: {
                organizationId: true,
                departmentId: true,
                department: { select: { name: true } },
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
    const department = leave.user.profile.department.name;
    const leaveType = leaveTypeFromCode(leave.type.code);
    const start = toDateKey(leave.startDate);
    const end = toDateKey(leave.endDate);
    const days = inclusiveDayCount(start, end);

    const peers = await prisma.leaveRequest.findMany({
      where: {
        id: { not: leave.id },
        status: { in: ["pending", "approved"] },
        user: {
          profile: {
            organizationId: orgId,
            departmentId: leave.user.profile.departmentId,
          },
        },
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
      type: leaveType,
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
      suggestion = clashCount > 0 || (leaveType === "paid" && leave.user.profile.paidLeaveBalance < days)
        ? "review"
        : "approve";
      bullets = [
        `${leaveType} leave for ${days} day(s): ${leave.remarks.slice(0, 160)}`,
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
