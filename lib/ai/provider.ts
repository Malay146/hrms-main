import { createOpenAI } from "@ai-sdk/openai";

/**
 * One place that picks the language model.
 *
 * - OpenAI (default): set OPENAI_API_KEY. Model defaults to gpt-4o-mini.
 * - Any OpenAI-compatible provider (Google Gemini, Groq, OpenRouter, Ollama, …):
 *   set AI_BASE_URL, AI_MODEL and AI_API_KEY. Local servers (localhost) need no key.
 *   Until AI_API_KEY is filled in, the app keeps using OpenAI, and the OpenAI key
 *   is never sent to the other provider.
 *
 * The model must support JSON-schema structured outputs.
 */
export function aiProviderConfig() {
  const baseURL = process.env.AI_BASE_URL?.trim() || undefined;
  const compatibleKey = process.env.AI_API_KEY?.trim() || undefined;
  const openaiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
  const local = baseURL ? /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(baseURL) : false;

  if (baseURL && (compatibleKey || local)) {
    return {
      provider: "compatible" as const,
      baseURL,
      apiKey: compatibleKey ?? "local",
      modelId: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
      configured: true,
    };
  }
  return {
    provider: "openai" as const,
    baseURL: undefined,
    apiKey: openaiKey,
    modelId: "gpt-4o-mini",
    configured: Boolean(openaiKey),
  };
}

export function isAiConfigured() {
  return aiProviderConfig().configured;
}

export function aiModel() {
  const config = aiProviderConfig();
  if (config.provider === "openai") {
    return createOpenAI({ apiKey: config.apiKey })(config.modelId);
  }
  // Compatible providers implement Chat Completions, not the Responses API.
  return createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey, name: "compatible" }).chat(
    config.modelId,
  );
}
