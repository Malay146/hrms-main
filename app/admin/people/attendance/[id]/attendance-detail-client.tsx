"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/toast";
import { upsertAttendanceAction } from "@/lib/actions/people/attendance";
import type { AttendanceLogItem, AttendanceStatus } from "@/lib/shared/types";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

function timeFromDisplay(value: string) {
  if (!value || value === "--:--") return "";
  // Display is like "9:30 AM" — form uses type=time needing HH:mm; keep empty and let user set.
  return "";
}

export function AttendanceDetailClient({ initial }: { initial: AttendanceLogItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );
  const [checkIn, setCheckIn] = useState(timeFromDisplay(initial.checkIn));
  const [checkOut, setCheckOut] = useState(timeFromDisplay(initial.checkOut));
  const [status, setStatus] = useState<AttendanceStatus>(
    initial.status === "Half Day"
      ? "half_day"
      : initial.status === "Leave"
        ? "leave"
        : initial.status === "Absent"
          ? "absent"
          : "present",
  );
  const [notes, setNotes] = useState("");

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertAttendanceAction({
        id: initial.id,
        userId: initial.userId,
        date: initial.dateKey,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        status,
        notes: notes || null,
      });
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setToast({ message: "Attendance updated.", type: "success" });
      router.refresh();
    });
  }

  return (
    <>
      <div>
        <h1 className="text-h1 font-medium">{initial.name}</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          {initial.date} · {initial.department}
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Current worked: {initial.workingHours}
          {initial.overtimeHours != null ? ` · OT ${initial.overtimeHours}h` : ""}
          {initial.manualEdit ? " · manual edit" : ""}
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Check in (HH:mm)</span>
          <input
            type="time"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Check out (HH:mm)</span>
          <input
            type="time"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            className={inputClass}
          >
            <option value="present">Present</option>
            <option value="half_day">Half day</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save correction"}
          </button>
        </div>
      </form>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </>
  );
}
