"use client";

import React, { useMemo, useState, useTransition } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import { daysPerWeek, lineHours, weeklyHours } from "@/lib/people/schedule-hours";
import {
  upsertScheduleAction,
  type ScheduleListItem,
} from "@/lib/actions/people/schedules";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

type DraftLine = {
  key: string;
  weekday: number;
  startMin: number;
  endMin: number;
  breakMin: number;
};

function minutesToTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function defaultLines(): DraftLine[] {
  return WEEKDAYS.slice(0, 5).map((day) => ({
    key: crypto.randomUUID(),
    weekday: day.value,
    startMin: 9 * 60,
    endMin: 18 * 60,
    breakMin: 60,
  }));
}

function linesFromSchedule(schedule: ScheduleListItem): DraftLine[] {
  return schedule.lines.map((line) => ({
    key: line.id,
    weekday: line.weekday,
    startMin: line.startMin,
    endMin: line.endMin,
    breakMin: line.breakMin,
  }));
}

export function SchedulesClient({
  initialSchedules,
}: {
  initialSchedules: ScheduleListItem[];
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [calendarType, setCalendarType] = useState<"fixed" | "variable">("fixed");
  const [active, setActive] = useState(true);
  const [lines, setLines] = useState<DraftLine[]>(defaultLines);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  const totals = useMemo(
    () => ({
      hours: weeklyHours(lines),
      days: daysPerWeek(lines),
    }),
    [lines],
  );

  function openCreate() {
    setEditingId(undefined);
    setName("");
    setCalendarType("fixed");
    setActive(true);
    setLines(defaultLines());
    setEditorOpen(true);
  }

  function openEdit(schedule: ScheduleListItem) {
    setEditingId(schedule.id);
    setName(schedule.name);
    setCalendarType(schedule.calendarType);
    setActive(schedule.active);
    setLines(linesFromSchedule(schedule));
    setEditorOpen(true);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertScheduleAction({
        id: editingId,
        name,
        calendarType,
        active,
        timezone: "Asia/Kolkata",
        lines: lines.map(({ weekday, startMin, endMin, breakMin }) => ({
          weekday,
          startMin,
          endMin,
          breakMin,
        })),
      });
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setSchedules((prev) => {
        const without = prev.filter((row) => row.id !== result.data.id);
        return [result.data, ...without].sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      });
      setEditorOpen(false);
      setToast({
        message: editingId ? `Updated ${result.data.name}.` : `Created ${result.data.name}.`,
        type: "success",
      });
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-medium">Working Schedules</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Fixed and variable calendars used for attendance and payroll days.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all"
        >
          <Plus className="size-4" />
          Add schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center border border-dashed border-border rounded-xl">
          <CalendarClock className="size-8 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-500">No schedules yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Calendar</th>
                <th className="px-4 py-3">Days / week</th>
                <th className="px-4 py-3">Hours / week</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr
                  key={schedule.id}
                  className="border-t border-border hover:bg-surface-hover/40"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(schedule)}
                      className="cursor-pointer font-semibold text-zinc-950 hover:underline"
                    >
                      {schedule.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600">
                    {schedule.calendarType}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{schedule.daysPerWeek}</td>
                  <td className="px-4 py-3 text-zinc-600">{schedule.hoursPerWeek}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        schedule.active
                          ? "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200"
                      }
                    >
                      {schedule.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? "Edit schedule" : "Add schedule"}
        description="Total weekly hours are derived from the day lines."
        className="max-w-2xl"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-zinc-500">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
                placeholder="Standard 5-day"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-zinc-500">Calendar type</span>
              <select
                value={calendarType}
                onChange={(e) => setCalendarType(e.target.value as "fixed" | "variable")}
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
              >
                <option value="fixed">Fixed</option>
                <option value="variable">Variable</option>
              </select>
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Active
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Working days
              </span>
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    {
                      key: crypto.randomUUID(),
                      weekday: 1,
                      startMin: 9 * 60,
                      endMin: 18 * 60,
                      breakMin: 60,
                    },
                  ])
                }
                className="cursor-pointer text-xs font-semibold text-zinc-700 hover:text-zinc-950"
              >
                Add day
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="grid grid-cols-[72px_1fr_1fr_88px_36px] gap-2 items-center"
                >
                  <select
                    value={line.weekday}
                    onChange={(e) =>
                      updateLine(line.key, { weekday: Number(e.target.value) })
                    }
                    className="h-9 px-2 border border-border rounded-lg text-xs bg-surface"
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={minutesToTime(line.startMin)}
                    onChange={(e) =>
                      updateLine(line.key, { startMin: timeToMinutes(e.target.value) })
                    }
                    className="h-9 px-2 border border-border rounded-lg text-xs bg-surface"
                  />
                  <input
                    type="time"
                    value={minutesToTime(line.endMin)}
                    onChange={(e) =>
                      updateLine(line.key, { endMin: timeToMinutes(e.target.value) })
                    }
                    className="h-9 px-2 border border-border rounded-lg text-xs bg-surface"
                  />
                  <input
                    type="number"
                    min={0}
                    value={line.breakMin}
                    onChange={(e) =>
                      updateLine(line.key, { breakMin: Number(e.target.value) || 0 })
                    }
                    className="h-9 px-2 border border-border rounded-lg text-xs bg-surface"
                    title="Break minutes"
                  />
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((row) => row.key !== line.key))}
                    className="cursor-pointer h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-zinc-400 hover:text-zinc-800 hover:bg-surface-hover"
                    aria-label="Remove day"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <p className="col-span-5 text-[11px] text-zinc-400 font-medium -mt-1">
                    {lineHours(line.startMin, line.endMin, line.breakMin)}h worked
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-zinc-50 px-3 py-2">
            <span className="text-xs font-semibold text-zinc-500">Total weekly hours</span>
            <span className="text-sm font-bold text-zinc-950">
              {totals.hours}h · {totals.days} days
            </span>
          </div>

          <button
            type="submit"
            disabled={pending || lines.length === 0}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save schedule"}
          </button>
        </form>
      </Modal>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
