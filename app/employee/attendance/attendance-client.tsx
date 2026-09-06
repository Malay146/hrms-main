"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownRight, ArrowUpRight, FilterX } from "lucide-react";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import ShiftClockIcon from "@/components/icons/late";
import { ShiftElapsedTimer } from "@/components/attendance/shift-elapsed-timer";
import { clockInAction, clockOutAction } from "@/lib/actions/people/attendance";
import type { AttendanceLogItem } from "@/lib/shared/types";

const STATUS_FILTERS = ["All", "Present", "Late", "Half Day", "Leave", "Absent"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
type SortKey = "date" | "checkIn" | "checkOut" | "hours" | "status";

function compareLogs(a: AttendanceLogItem, b: AttendanceLogItem, key: SortKey, dir: 1 | -1) {
  const mul = dir;
  if (key === "date") return a.dateKey.localeCompare(b.dateKey) * mul;
  if (key === "checkIn") return a.checkIn.localeCompare(b.checkIn) * mul;
  if (key === "checkOut") return a.checkOut.localeCompare(b.checkOut) * mul;
  if (key === "hours") return ((a.workedHours ?? 0) - (b.workedHours ?? 0)) * mul;
  return a.status.localeCompare(b.status) * mul;
}

export function EmployeeAttendanceClient({
  initialLogs,
  initialClock,
}: {
  initialLogs: AttendanceLogItem[];
  initialClock: {
    isClockedIn: boolean;
    checkInLabel: string;
    checkInAt: string | null;
    workedHours: string;
  };
}) {
  const [logs] = useState(initialLogs);
  const [clock, setClock] = useState(initialClock);
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const lateCount = logs.filter((log) => log.late).length;
  const onTimeRate =
    logs.length === 0 ? "0%" : `${Math.round(((logs.length - lateCount) / logs.length) * 100)}%`;

  const filtered = useMemo(() => {
    const rows = logs.filter((log) => {
      if (statusFilter !== "All" && log.status !== statusFilter) return false;
      if (from && log.dateKey < from) return false;
      if (to && log.dateKey > to) return false;
      return true;
    });
    return [...rows].sort((a, b) => compareLogs(a, b, sortKey, sortDir));
  }, [logs, statusFilter, from, to, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 1 ? -1 : 1));
      return;
    }
    setSortKey(key);
    setSortDir(key === "date" ? -1 : 1);
  }

  function clearFilters() {
    setStatusFilter("All");
    setFrom("");
    setTo("");
  }

  function toggleClock() {
    startTransition(async () => {
      const result = clock.isClockedIn ? await clockOutAction() : await clockInAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if ("hours" in result.data) {
        setClock({
          isClockedIn: false,
          checkInLabel: "",
          checkInAt: null,
          workedHours: result.data.hours,
        });
        toast.success("Clocked out.");
        return;
      }
      setClock({
        isClockedIn: true,
        checkInLabel: result.data.checkIn,
        checkInAt: result.data.checkInAt,
        workedHours: clock.workedHours,
      });
      toast.success("Clocked in.");
    });
  }

  const sortMark = (key: SortKey) =>
    sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "";

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">My Attendance Logs</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Review your historical shift logs, work hours, and arrival stats.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={toggleClock}
          className={cn(
            "cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-2xs active:scale-98 transition-all shrink-0",
            clock.isClockedIn
              ? "bg-red-50 text-red-700 border border-red-200/50 hover:bg-red-100/50"
              : "bg-zinc-900 hover:bg-zinc-800 text-white",
          )}
        >
          {clock.isClockedIn ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
          {clock.isClockedIn ? "Clock Out" : "Clock In"}
        </button>
      </div>

      <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-left">
          <ShiftClockIcon className="size-13 text-zinc-600 shrink-0 mr-2" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Shift Clock</span>
            <span className="text-xl font-bold text-zinc-950 mt-1">
              {clock.isClockedIn ? `Clocked In at ${clock.checkInLabel}` : "Not Clocked In"}
            </span>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">
              Hours Worked Today: {clock.workedHours}
            </p>
          </div>
        </div>
        <ShiftElapsedTimer checkInAt={clock.checkInAt} running={clock.isClockedIn} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Logged days", value: String(logs.length) },
          { label: "Late arrivals", value: String(lateCount) },
          { label: "On-Time Arrival Rate", value: onTimeRate },
        ].map((stat) => (
          <div key={stat.label} className="border border-border rounded-xl p-5 bg-surface">
            <span className="text-sm font-medium text-zinc-500">{stat.label}</span>
            <span className="text-2xl font-bold text-zinc-950 mt-2 block">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500 min-w-[140px]">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
          />
        </label>
        <button
          type="button"
          onClick={clearFilters}
          className="cursor-pointer h-10 px-3 border border-border rounded-lg text-xs font-semibold text-zinc-600 hover:bg-surface-hover inline-flex items-center gap-1.5"
        >
          <FilterX className="size-3.5" />
          Clear
        </button>
        <p className="text-xs font-semibold text-zinc-400 lg:ml-auto pb-2">
          Showing {filtered.length} of {logs.length}
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/85 border-b text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {(
                [
                  ["date", "Work Date"],
                  ["checkIn", "Check In"],
                  ["checkOut", "Check Out"],
                  ["hours", "Working Hours"],
                  ["status", "Status"],
                ] as const
              ).map(([key, label]) => (
                <th key={key} className="py-3 px-6">
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="cursor-pointer inline-flex items-center gap-1 hover:text-zinc-900"
                  >
                    {label}
                    {sortMark(key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No attendance logs match these filters
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/30">
                  <td className="py-3.5 px-6 font-bold text-zinc-950">{log.date}</td>
                  <td className="py-3.5 px-6">{log.checkIn}</td>
                  <td className="py-3.5 px-6">{log.checkOut}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{log.workingHours}</td>
                  <td className="py-3.5 px-6">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                        log.status === "Present" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                        log.status === "Late" && "bg-amber-50 text-amber-700 border-amber-200/50",
                        log.status === "Half Day" && "bg-amber-50 text-amber-700 border-amber-200/50",
                        log.status === "Leave" && "bg-amber-50 text-amber-700 border-amber-200/50",
                        log.status === "Absent" && "bg-red-50 text-red-700 border-red-200/50",
                      )}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
