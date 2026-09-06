"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatElapsedParts(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return { hours, minutes, seconds, label: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
}

export function ShiftElapsedTimer({
  checkInAt,
  running,
  className,
  size = "lg",
}: {
  checkInAt: string | null;
  running: boolean;
  className?: string;
  size?: "lg" | "md";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || !checkInAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running, checkInAt]);

  const started = checkInAt ? Date.parse(checkInAt) : NaN;
  const elapsed =
    running && Number.isFinite(started) ? Math.max(0, (now - started) / 1000) : 0;
  const parts = formatElapsedParts(elapsed);

  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums tracking-tight text-zinc-950",
          size === "lg" ? "text-3xl" : "text-xl",
        )}
      >
        {parts.label}
      </span>
      <span className="text-xs font-semibold text-zinc-400 mt-0.5">
        {running ? "Hours · Minutes · Seconds" : "00:00:00 when you clock in"}
      </span>
    </div>
  );
}
