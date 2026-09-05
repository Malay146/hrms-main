"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDateKey, kolkataTodayKey } from "@/lib/shared/dates";
import type { CalendarMarker } from "@/lib/shared/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type AttendanceCalendarProps = {
  markers: CalendarMarker[];
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
};

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function buildCells(year: number, month: number) {
  const firstDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: { key: string; day: number; inMonth: boolean }[] = [];

  for (let i = firstDow - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const prev = shiftMonth(year, month, -1);
    cells.push({ key: formatDateKey(prev.year, prev.month, day), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: formatDateKey(year, month, day), day, inMonth: true });
  }

  const next = shiftMonth(year, month, 1);
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      key: formatDateKey(next.year, next.month, nextDay),
      day: nextDay,
      inMonth: false,
    });
    nextDay += 1;
  }

  return cells;
}

function inRange(key: string, from: string, to: string) {
  if (!from || !to) return false;
  const start = from < to ? from : to;
  const end = from < to ? to : from;
  return key >= start && key <= end;
}

export function AttendanceCalendar({ markers, from, to, onRangeChange }: AttendanceCalendarProps) {
  const today = kolkataTodayKey();
  const initial = today.split("-").map(Number);
  const [{ year, month }, setCursor] = useState({ year: initial[0], month: initial[1] });

  const markerMap = useMemo(() => {
    const map = new Map<string, CalendarMarker["kind"]>();
    for (const marker of markers) map.set(marker.date, marker.kind);
    return map;
  }, [markers]);

  const cells = useMemo(() => buildCells(year, month), [year, month]);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  function handleSelect(key: string) {
    if (!from || (from && to)) {
      onRangeChange(key, "");
      return;
    }
    if (key < from) {
      onRangeChange(key, from);
      return;
    }
    onRangeChange(from, key);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-text-primary">Attendance calendar</h2>
          <p className="text-xs font-medium text-text-tertiary mt-0.5">
            Click a day to start a leave range, then click the end date.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
            className="size-8 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-border-strong text-icon-secondary hover:text-text-primary active:scale-98 transition-all duration-150 flex items-center justify-center"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-text-primary">
            {label}
          </span>
          <button
            type="button"
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
            className="size-8 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-border-strong text-icon-secondary hover:text-text-primary active:scale-98 transition-all duration-150 flex items-center justify-center"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-text-tertiary"
          >
            {day}
          </div>
        ))}
        {cells.map((cell) => {
          const kind = markerMap.get(cell.key);
          const isToday = cell.key === today;
          const isStart = cell.key === from;
          const isEnd = Boolean(to) && cell.key === to;
          const isEndpoint = isStart || isEnd;
          const ranged = inRange(cell.key, from, to);

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => handleSelect(cell.key)}
              className={cn(
                "relative h-10 rounded-lg text-sm font-semibold transition-colors duration-150",
                "hover:bg-surface-hover active:scale-98",
                !cell.inMonth && "text-text-disabled",
                cell.inMonth && !isEndpoint && "text-text-primary",
                kind === "present" && cell.inMonth && !isEndpoint && "bg-success-soft text-success",
                kind === "absent" && cell.inMonth && !isEndpoint && "bg-error-soft text-error",
                kind === "leave" && cell.inMonth && !isEndpoint && "bg-warning-soft text-warning",
                ranged && !isEndpoint && "bg-surface-secondary",
                isEndpoint && "bg-zinc-900 text-white hover:bg-zinc-800",
                isToday && !isEndpoint && "ring-1 ring-zinc-900/40 ring-inset",
              )}
            >
              {cell.day}
              {kind && cell.inMonth && !isEndpoint ? (
                <span
                  className={cn(
                    "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full",
                    kind === "present" && "bg-success",
                    kind === "absent" && "bg-error",
                    kind === "leave" && "bg-warning",
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-error" />
          Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" />
          Leave
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-zinc-900" />
          Selected
        </span>
      </div>
    </div>
  );
}
