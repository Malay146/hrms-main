"use client";

import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDateKey, kolkataTodayKey } from "@/lib/shared/dates";

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

function displayLabel(key: string) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  className,
}: DatePickerProps) {
  const today = kolkataTodayKey();
  const seed = (value || today).split("-").map(Number);
  const [{ year, month }, setCursor] = useState({ year: seed[0], month: seed[1] });
  const [open, setOpen] = useState(false);
  const cells = useMemo(() => buildCells(year, month), [year, month]);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer w-full h-10 px-3 border border-border rounded-lg text-sm text-left bg-surface hover:border-border-strong flex items-center justify-between gap-2"
      >
        <span className={cn(value ? "text-zinc-900 font-medium" : "text-zinc-400")}>
          {value ? displayLabel(value) : placeholder}
        </span>
        <CalendarIcon className="size-4 text-zinc-400 shrink-0" />
      </button>
      {open ? (
        <div className="absolute z-50 mt-2 w-[280px] right-0 border border-border rounded-xl bg-surface shadow-lg p-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
              className="cursor-pointer p-1 rounded-md hover:bg-surface-hover text-zinc-500"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold text-zinc-900">{label}</span>
            <button
              type="button"
              onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
              className="cursor-pointer p-1 rounded-md hover:bg-surface-hover text-zinc-500"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <span key={d} className="text-[10px] font-semibold text-zinc-400 text-center py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const disabled = Boolean(min && cell.key < min);
              const selected = value === cell.key;
              const isToday = cell.key === today;
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={disabled || !cell.inMonth}
                  onClick={() => {
                    onChange(cell.key);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-8 rounded-md text-xs font-semibold transition-colors",
                    !cell.inMonth && "text-zinc-300",
                    cell.inMonth && !selected && "text-zinc-700 hover:bg-zinc-100",
                    selected && "bg-zinc-900 text-white hover:bg-zinc-800",
                    isToday && !selected && "ring-1 ring-zinc-300",
                    disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                    !disabled && cell.inMonth && "cursor-pointer",
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
