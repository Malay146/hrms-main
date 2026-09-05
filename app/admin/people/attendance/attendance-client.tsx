"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/cn";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import LateIcon from "@/components/icons/late";
import type { AttendanceLogItem } from "@/lib/types";

export function AttendanceClient({
  initialLogs,
}: {
  initialLogs: AttendanceLogItem[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  const filtered = initialLogs.filter((log) => {
    const matchesSearch =
      log.name.toLowerCase().includes(search.toLowerCase()) ||
      log.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "All" || log.status === status;
    return matchesSearch && matchesStatus;
  });

  const present = initialLogs.filter((log) => log.status === "Present" || log.status === "Late").length;
  const late = initialLogs.filter((log) => log.late).length;
  const leave = initialLogs.filter((log) => log.status === "Leave").length;
  const absent = initialLogs.filter((log) => log.status === "Absent").length;
  const statuses = useMemo(
    () => ["All", ...new Set(initialLogs.map((log) => log.status))],
    [initialLogs],
  );

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">Attendance</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Daily check-in log with Present, Absent, Half Day, and Leave statuses.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Present", value: present, icon: PresentTodayIcon, bgStart: "#059669", bgEnd: "#34D399" },
          { label: "Late arrivals", value: late, icon: LateIcon, bgStart: "#D97706", bgEnd: "#FBBF24" },
          { label: "On leave", value: leave, icon: LeaveTodayIcon, bgStart: "#D97706", bgEnd: "#FBBF24" },
          { label: "Absent", value: absent, icon: LateIcon, bgStart: "#71717A", bgEnd: "#A1A1AA" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-border rounded-xl p-5 bg-surface">
              <div className="size-12 rounded-lg flex items-center justify-center text-white" style={{ background: `linear-gradient(to top, ${stat.bgStart}, ${stat.bgEnd})` }}>
                <Icon className="size-[30px]" />
              </div>
              <p className="text-2xl font-bold text-zinc-950 mt-4">{stat.value}</p>
              <p className="text-sm font-medium text-zinc-500 mt-2">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-3">
          <Search className="size-4 absolute left-3 top-3 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee"
            className="h-10 w-full pl-9 border border-border rounded-lg text-sm"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm">
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Employee</th>
              <th className="py-3.5 px-6">Date</th>
              <th className="py-3.5 px-6">Check In</th>
              <th className="py-3.5 px-6">Check Out</th>
              <th className="py-3.5 px-6">Hours</th>
              <th className="py-3.5 px-6">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No attendance logs found
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50">
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-zinc-100 font-bold text-xs flex items-center justify-center">{log.avatar}</div>
                      <div>
                        <p className="font-semibold text-zinc-900">{log.name}</p>
                        <p className="text-xs text-zinc-400">{log.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-6">{log.date}</td>
                  <td className="py-3.5 px-6">{log.checkIn}</td>
                  <td className="py-3.5 px-6">{log.checkOut}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{log.workingHours}</td>
                  <td className="py-3.5 px-6">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      log.status === "Present" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                      log.status === "Late" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      log.status === "Half Day" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      log.status === "Leave" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      log.status === "Absent" && "bg-red-50 text-red-700 border-red-200/50",
                    )}>
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
