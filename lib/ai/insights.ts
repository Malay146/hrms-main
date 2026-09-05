import type { AiInsightCard } from "@/lib/shared/types";

export const ALLOWED_INSIGHT_HREFS = [
  "/admin/people/leave",
  "/admin/people/attendance",
  "/admin/people/employees",
  "/admin/hr/payroll",
  "/admin/hr/performance",
  "/admin/analytics",
] as const;

const SEVERITIES = new Set(["info", "watch", "alert"]);

function asString(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/** Map model JSON into insight cards; drop unknown severity, empty titles, and off-app hrefs. */
export function mapInsightCards(raw: unknown): AiInsightCard[] {
  if (!raw || typeof raw !== "object") return [];
  const list = Array.isArray(raw) ? raw : (raw as { insights?: unknown }).insights;
  if (!Array.isArray(list)) return [];

  const cards: AiInsightCard[] = [];
  for (const item of list.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const severity = asString(row.severity, 16);
    const title = asString(row.title, 80);
    const body = asString(row.body, 600);
    const action = asString(row.action, 160);
    if (!SEVERITIES.has(severity) || !title || !body || !action) continue;
    const hrefRaw = asString(row.href, 80);
    const href = ALLOWED_INSIGHT_HREFS.includes(hrefRaw as (typeof ALLOWED_INSIGHT_HREFS)[number])
      ? hrefRaw
      : undefined;
    cards.push({
      id: crypto.randomUUID(),
      severity: severity as AiInsightCard["severity"],
      title,
      body,
      action,
      href,
      metricKey: asString(row.metricKey, 40) || undefined,
    });
  }
  return cards;
}
