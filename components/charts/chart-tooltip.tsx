"use client";

import type { ReactNode } from "react";

type PayloadItem = {
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
};

/** Zinc-branded Recharts tooltip shell used across admin/employee charts. */
export function ChartTooltipShell({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: ReactNode;
  rows: { label: string; value: ReactNode; color?: string }[];
}) {
  if (!active || rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold shadow-md min-w-[120px] opacity-100 dark:bg-zinc-900">
      {label != null && label !== "" ? (
        <p className="text-zinc-900 font-bold mb-1 dark:text-zinc-50">{label}</p>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <p key={row.label} className="text-zinc-600 flex items-center gap-2 dark:text-zinc-400">
            {row.color ? (
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
            ) : null}
            <span>
              {row.label}: <span className="text-zinc-950 font-bold dark:text-zinc-50">{row.value}</span>
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function BarChartTooltip({
  active,
  payload,
  label,
  valueLabel = "Value",
}: {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string;
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!;
  return (
    <ChartTooltipShell
      active
      label={label}
      rows={[{ label: valueLabel, value: item.value ?? "—", color: item.color }]}
    />
  );
}

export function PieChartTooltip({
  active,
  payload,
  valueLabel = "Count",
}: {
  active?: boolean;
  payload?: PayloadItem[];
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!;
  const data = item.payload ?? {};
  const name = (data.name as string | undefined) ?? String(item.name ?? "");
  const value = (data.value as number | undefined) ?? item.value;
  const pct = data.percentage as string | undefined;
  const color = (data.color as string | undefined) ?? item.color;
  return (
    <ChartTooltipShell
      active
      label={name}
      rows={[
        { label: valueLabel, value: value ?? "—", color },
        ...(pct ? [{ label: "Share", value: pct }] : []),
      ]}
    />
  );
}

export const chartCursor = { fill: "rgba(24, 24, 27, 0.04)", radius: 6 } as const;

/** Keep custom tooltips above donut center labels / sibling overlays. */
export const chartTooltipWrapperStyle = {
  zIndex: 40,
  outline: "none",
  opacity: 1,
  pointerEvents: "none" as const,
};
