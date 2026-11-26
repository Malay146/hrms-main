import { generateText, Output } from "ai";
import { z } from "zod";
import { classifyWorkforceReportQuestion, type WorkforceReportTemplate } from "@/lib/analytics/workforce";
import { logger } from "@/lib/shared/logger";
import { aiModel, isAiConfigured } from "./provider";

function model() {
  return aiModel();
}

const reportPlanSchema = z.object({
  template: z.enum(["attendance", "leave", "performance", "skill_gap", "unsupported"]),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  departmentName: z.string().nullable(),
});

export type WorkforceReportPlan = z.infer<typeof reportPlanSchema>;

const recommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      skillName: z.string().max(80),
      action: z.string().max(220),
      reason: z.string().max(180),
    }),
  ).max(6),
});

const narrativeSchema = z.object({
  observations: z.array(z.string().max(220)).min(1).max(4),
});

function keywordReportPlan(question: string): WorkforceReportPlan {
  const template: WorkforceReportTemplate = classifyWorkforceReportQuestion(question);
  return { template, startDate: null, endDate: null, departmentName: null };
}

/**
 * `today` (YYYY-MM-DD, Kolkata) anchors relative dates such as "last month";
 * without it the model guesses the year from its training data.
 * If the model fails, the keyword classifier answers instead, and the caller's
 * default date range applies.
 */
export async function interpretWorkforceReport(question: string, today: string): Promise<WorkforceReportPlan> {
  if (/turnover|attrition|resign|left the company/i.test(question)) {
    return { template: "unsupported", startDate: null, endDate: null, departmentName: null };
  }
  if (!isAiConfigured()) return keywordReportPlan(question);

  try {
    const { output } = await generateText({
      model: model(),
      output: Output.object({ schema: reportPlanSchema }),
      system: `Classify an HR report question into one allowed template. Do not write SQL.
Use attendance for attendance/absence, leave for leave usage, performance for ratings/goals, skill_gap for role skill gaps, and unsupported for turnover or anything else.
Today is ${today}. Return a date range only when the question specifies one, in YYYY-MM-DD, resolving relative periods against today. A department name may be returned only when explicitly named.
The application will validate all fields and execute a fixed, parameterized database query.`,
      prompt: question.slice(0, 1000),
    });
    if (!output) throw new Error("The AI report planner returned no result.");
    return output;
  } catch (error) {
    logger.warn("workforce.report.plan_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return keywordReportPlan(question);
  }
}

export async function generateSkillRecommendations(input: {
  role: string;
  skills: { name: string; proficiency: number }[];
  gaps: { skillName: string; currentLevel: number; targetLevel: number }[];
  goalCompletionPct: number | null;
}) {
  if (!isAiConfigured()) {
    throw new Error("AI recommendations need an AI provider to be configured.");
  }
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: recommendationSchema }),
    system: `Give practical, supportive learning recommendations based only on the supplied role, skill levels, skill gaps, and goal-completion percentage.
Do not infer performance, promotion, retention, or employment outcomes. Do not request or invent personal data.
Recommend short learning actions that address the largest gaps. Return only the structured recommendations.`,
    prompt: JSON.stringify(input),
  });
  if (!output) throw new Error("The AI did not return learning recommendations.");
  return output.recommendations;
}

export async function generateWorkforce360Observations(input: {
  role: string;
  period: string;
  attendancePct: number | null;
  previousAttendancePct: number | null;
  absentDays: number;
  approvedLeaveDays: number;
  previousApprovedLeaveDays: number;
  latestRating: number | null;
  previousRating: number | null;
  goalCompletionPct: number | null;
  previousGoalCompletionPct: number | null;
  recordedAttendanceDays: number;
}) {
  if (!isAiConfigured()) {
    throw new Error("AI observations need an AI provider to be configured.");
  }
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: narrativeSchema }),
    system: `Describe factual HR trends using only the supplied aggregated metrics.
Mention data coverage and avoid causal claims, predictions, risk scoring, recommendations about employment decisions, or judgments about the person.
Do not infer anything from missing data. Keep each observation concise and neutral.`,
    prompt: JSON.stringify(input),
  });
  if (!output) throw new Error("The AI did not return workforce observations.");
  return output.observations;
}

export async function explainWorkforceReport(input: {
  rows: { label: string; value: string; detail: string; chartValue: number }[];
  periodLabel: string;
}) {
  if (!isAiConfigured()) {
    return { summary: "Report generated from approved HR metrics. AI narration is unavailable until an AI provider is configured.", aiSummaryAvailable: false };
  }
  const { text } = await generateText({
    model: model(),
    system: `Summarize this HR report in no more than three neutral sentences.
Use only the supplied aggregated rows. Do not identify or infer facts about individual employees. State when the result is empty.`,
    prompt: JSON.stringify(input),
  });
  const summary = text.trim();
  if (!summary) throw new Error("The AI did not return a report summary.");
  return { summary, aiSummaryAvailable: true };
}
