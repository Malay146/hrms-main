"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { cn } from "@/utils/cn";
import ShiftClockIcon from "@/components/icons/late";
import { Toast } from "@/components/ui/toast";
import { clockInAction, clockOutAction } from "@/lib/actions/people/attendance";
import type { EmployeeDashboardData } from "@/lib/shared/types";

export function EmployeeDashboardClient({
  initial,
}: {
  initial: EmployeeDashboardData;
}) {
  const [data, setData] = useState(initial);
  const [mounted] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleClock() {
    setPending(true);
    const result = data.isClockedIn ? await clockOutAction() : await clockInAction();
    setPending(false);
    if (!result.ok) {
      setToast({ message: result.error, type: "error" });
      return;
    }
    const payload = result.data;
    if ("hours" in payload) {
      const hours = payload.hours;
      setData((prev) => ({ ...prev, isClockedIn: false, workedHours: hours }));
    } else {
      const checkIn = payload.checkIn;
      setData((prev) => ({ ...prev, isClockedIn: true, checkInLabel: checkIn }));
    }
    setToast({ message: data.isClockedIn ? "Clocked out." : "Clocked in.", type: "success" });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col text-left">
          <h1 className="text-h1 font-medium">Welcome Back, {data.firstName}</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Here is your workspace summary for today, {data.todayLabel}.
          </p>
        </div>
        <button
          disabled={pending}
          onClick={toggleClock}
          className={cn(
            "cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-2xs active:scale-98 transition-all",
            data.isClockedIn
              ? "bg-red-50 text-red-700 border border-red-200/50 hover:bg-red-100/50"
              : "bg-zinc-900 hover:bg-zinc-800 text-white",
          )}
        >
          {data.isClockedIn ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
          {data.isClockedIn ? "Clock Out" : "Clock In"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Work Status", value: data.isClockedIn ? "Clocked In" : "Clocked Out", color: data.isClockedIn ? "text-emerald-600" : "text-red-500" },
          { label: "Remaining Leave Balance", value: `${data.remainingLeave} Days` },
          { label: "Hours today", value: data.workedHours },
          { label: "Upcoming Event", value: "Q3 Town Hall" },
        ].map((stat) => (
          <div key={stat.label} className="border border-border rounded-xl p-5 bg-surface">
            <span className="text-sm font-medium text-zinc-500">{stat.label}</span>
            <span className={cn("text-2xl font-bold text-zinc-950 mt-2 block", stat.color)}>{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-2xl p-5 bg-surface flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-left">
          <ShiftClockIcon className="size-13 text-zinc-600 shrink-0 mr-2" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Shift Clock</span>
            <span className="text-xl font-bold text-zinc-950 mt-1">
              {data.isClockedIn ? `Clocked In at ${data.checkInLabel}` : "Not Clocked In"}
            </span>
            <p className="text-xs text-zinc-400 font-semibold mt-0.5">Hours Worked Today: {data.workedHours}</p>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-2xl p-5 bg-surface">
        <h2 className="text-base font-bold text-zinc-950 mb-4 text-left">Weekly Work Hours</h2>
        <div className="h-[200px]">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyHours} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E4E4E7" />
                    <stop offset="100%" stopColor="#18181B" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F4F4F5" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#A1A1AA", fontSize: 11, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} domain={[0, 10]} />
                <Tooltip />
                <Bar dataKey="hours" fill="url(#hoursGrad)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
