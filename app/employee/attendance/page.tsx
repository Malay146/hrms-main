"use client";

import React, { useState } from "react";
import {
  Clock,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/utils/cn";

const initialMyLogs = [
  {
    date: "17 Jul 2026",
    checkIn: "08:52 AM",
    checkOut: "04:58 PM",
    hours: "8.1 hrs",
    status: "On Time",
  },
  {
    date: "16 Jul 2026",
    checkIn: "08:58 AM",
    checkOut: "05:02 PM",
    hours: "8.0 hrs",
    status: "On Time",
  },
  {
    date: "15 Jul 2026",
    checkIn: "09:00 AM",
    checkOut: "05:00 PM",
    hours: "8.0 hrs",
    status: "On Time",
  },
  {
    date: "14 Jul 2026",
    checkIn: "09:25 AM",
    checkOut: "05:15 PM",
    hours: "7.8 hrs",
    status: "Late",
  },
  {
    date: "13 Jul 2026",
    checkIn: "08:55 AM",
    checkOut: "05:05 PM",
    hours: "8.1 hrs",
    status: "On Time",
  },
];

export default function EmployeeAttendancePage() {
  const [logs] = useState(initialMyLogs);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "On Time":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Late":
      default:
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
    }
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col text-left">
          <h1 className="text-h1 font-medium">My Attendance Logs</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Review your historical shift logs, work hours, and arrival stats.
          </p>
        </div>
        <button className="cursor-pointer flex items-center gap-2 px-3.5 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all shrink-0">
          <FileSpreadsheet className="size-4 text-zinc-400" />
          Export Timesheet
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
        {[
          { label: "Hours Worked This Week", value: "40.0 hrs" },
          { label: "Average Arrival Time", value: "09:02 AM" },
          { label: "On-Time Arrival Rate", value: "80%" },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between"
          >
            <span className="text-sm font-medium text-zinc-500">
              {stat.label}
            </span>
            <span className="text-2xl font-bold text-zinc-950 mt-2">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Logs Table */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-zinc-950 text-left">
          Shift Attendance History
        </h2>
        <div className="border border-border rounded-xl bg-surface overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50/85 border-b border-border text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-6">Work Date</th>
                <th className="py-3 px-6">Check In</th>
                <th className="py-3 px-6">Check Out</th>
                <th className="py-3 px-6">Working Hours</th>
                <th className="py-3 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-zinc-700 font-semibold">
              {logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="py-3.5 px-6 font-bold text-zinc-950">
                    {log.date}
                  </td>
                  <td className="py-3.5 px-6">{log.checkIn}</td>
                  <td className="py-3.5 px-6 text-zinc-450">{log.checkOut}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{log.hours}</td>
                  <td className="py-3.5 px-6">
                    <span
                      className={cn(
                        "whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
                        getStatusBadge(log.status),
                      )}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
