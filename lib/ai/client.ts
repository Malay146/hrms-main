import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { ALLOWED_INSIGHT_HREFS } from "./insights";

const insightSchema = z.object({
  insights: z
    .array(
      z.object({
        severity: z.enum(["info", "watch", "alert"]),
        title: z.string().max(80),
        body: z.string().max(600),
        action: z.string().max(160),
        href: z.string().optional(),
        metricKey: z.string().optional(),
      }),
    )
    .min(3)
    .max(6),
});

const leaveBriefSchema = z.object({
  bullets: z.array(z.string().max(200)).min(2).max(4),
  suggestion: z.enum(["approve", "review", "reject"]),
});

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function model() {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai("gpt-4o-mini");
}

export async function generateInsightCards(snapshotJson: unknown) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI provider is not configured.");
  }
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: insightSchema }),
    system: `You are an HR operations analyst for PeoplePay360.
Write concise, factual insight cards from the JSON metrics.
Cite numbers. Do not invent employees or departments.
Do not mention wages or bank accounts.
href must be one of: ${ALLOWED_INSIGHT_HREFS.join(", ")}.`,
    prompt: JSON.stringify(snapshotJson),
  });
  if (!output) {
    throw new Error("The model did not return insight cards.");
  }
  return output.insights;
}

export async function phraseCopilotAnswer(input: {
  question: string;
  facts: string;
  snapshotJson: unknown;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI provider is not configured.");
  }
  const { text } = await generateText({
    model: model(),
    system: `You are a staff HR copilot for PeoplePay360.
Answer only from the supplied facts and JSON metrics.
Do not invent people, departments, or numbers.
Do not mention bank accounts or individual wages.
Keep the answer to 1–3 short paragraphs.`,
    prompt: `Question: ${input.question}\n\nFacts:\n${input.facts}\n\nMetrics JSON:\n${JSON.stringify(input.snapshotJson)}`,
  });
  return text.trim();
}

export async function generateLeaveBrief(payload: unknown) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI provider is not configured.");
  }
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: leaveBriefSchema }),
    system: `You help an HR manager decide a leave request.
Return 2–4 short bullets and a suggestion of approve, review, or reject.
This is advisory only. Do not mention wages or bank details.`,
    prompt: JSON.stringify(payload),
  });
  if (!output) {
    throw new Error("The model did not return a leave brief.");
  }
  return output;
}
