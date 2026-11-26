import { createGoogle } from "@ai-sdk/google";

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const google = createGoogle({ apiKey });
  return google(process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL);
}
