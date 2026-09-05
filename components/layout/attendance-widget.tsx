"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/utils/cn";
import {
  clockInAction,
  clockOutAction,
  getTodayAttendance,
} from "@/lib/actions/people/attendance";

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function AttendanceWidget() {
  const [open, setOpen] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [checkInAt, setCheckInAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState("0h 00m");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  async function refresh() {
    const row = await getTodayAttendance();
    setCheckedIn(Boolean(row?.checkIn));
    setCheckedOut(Boolean(row?.checkOut));
    setCheckInAt(row?.checkIn ? new Date(row.checkIn) : null);
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 2000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  useEffect(() => {
    if (!checkInAt || checkedOut) return;
    const tick = () => setElapsed(formatElapsed(Date.now() - checkInAt.getTime()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [checkInAt, checkedOut]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleClock() {
    startTransition(async () => {
      setMessage(null);
      if (!checkedIn) {
        const result = await clockInAction();
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        await refresh();
        setMessage(`Checked in at ${result.data.checkIn}`);
        return;
      }
      if (!checkedOut) {
        const result = await clockOutAction();
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        await refresh();
        setMessage(`Checked out · ${result.data.hours}`);
      }
    });
  }

  const statusColor = checkedIn && !checkedOut ? "bg-emerald-500" : "bg-zinc-400";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex items-center justify-center w-10 h-10 bg-surface border border-border rounded-lg text-icon-secondary hover:text-text-primary hover:bg-surface-hover hover:border-border-strong shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer"
        aria-label="Attendance"
        title="Attendance"
      >
        <span className="text-xs font-bold tracking-tight">IN</span>
        <span className={cn("absolute top-2 right-2 size-1.5 rounded-full ring-1 ring-white", statusColor)} />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 w-64 bg-surface border border-border rounded-2xl shadow-lg p-4 z-50 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div>
            <p className="text-sm font-bold text-zinc-950">Today&apos;s attendance</p>
            <p className="text-xs font-medium text-zinc-500 mt-0.5">
              {checkedIn && !checkedOut
                ? `Checked in · ${elapsed}`
                : checkedOut
                  ? "Checked out for today"
                  : "Not checked in"}
            </p>
          </div>
          {message ? <p className="text-xs font-medium text-zinc-600">{message}</p> : null}
          <button
            type="button"
            disabled={pending || (checkedIn && checkedOut)}
            onClick={handleClock}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending
              ? "Working…"
              : !checkedIn
                ? "Check In"
                : checkedOut
                  ? "Done for today"
                  : "Check Out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
