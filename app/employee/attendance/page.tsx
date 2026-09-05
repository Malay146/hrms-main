"use client";

import React, { useState, useEffect } from "react";
import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/utils/cn";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";

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
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [draftAdjust, setDraftAdjust] = useState({
    date: "2026-07-14",
    checkIn: "09:25",
    checkOut: "17:15",
    reason: "",
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("adjust") === "1") {
      setIsAdjustOpen(true);
    }
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "On Time":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Late":
      default:
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
    }
  };

  const handleExport = () => {
    setIsExportOpen(false);
    toast.success("Timesheet exported", {
      description: "Your July 2026 timesheet is downloading.",
    });
  };

  const handleSubmitAdjustment = () => {
    if (!draftAdjust.reason.trim()) {
      toast.error("Reason required", {
        description: "Add a brief reason for the shift adjustment.",
      });
      return;
    }
    setIsAdjustOpen(false);
    toast.success("Adjustment submitted", {
      description: "HR will review your shift correction request.",
    });
    setDraftAdjust({
      date: "2026-07-14",
      checkIn: "09:25",
      checkOut: "17:15",
      reason: "",
    });
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col text-left">
          <h1 className="type-title">My Attendance Logs</h1>
          <p className="type-subtitle">
            Review your historical shift logs, work hours, and arrival stats.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsAdjustOpen(true)}
            className="cursor-pointer px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Request Adjustment
          </button>
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="cursor-pointer flex items-center gap-2 px-3.5 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            <FileSpreadsheet className="size-4 text-zinc-400" />
            Export Timesheet
          </button>
        </div>
      </div>

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

      <Modal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title="Export Timesheet"
        description="July 2026"
      >
        <div className="flex flex-col gap-4 text-left">
          <p className="text-sm text-zinc-600 font-medium">
            Download a CSV of your shift logs for payroll review.
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white active:scale-[0.98]"
          >
            Download CSV
          </button>
        </div>
      </Modal>

      <Modal
        open={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="Shift Adjustment Request"
        description="Correct a missed or incorrect clock entry"
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Work date
            <input
              type="date"
              value={draftAdjust.date}
              onChange={(e) =>
                setDraftAdjust((current) => ({ ...current, date: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Check in
              <input
                type="time"
                value={draftAdjust.checkIn}
                onChange={(e) =>
                  setDraftAdjust((current) => ({
                    ...current,
                    checkIn: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Check out
              <input
                type="time"
                value={draftAdjust.checkOut}
                onChange={(e) =>
                  setDraftAdjust((current) => ({
                    ...current,
                    checkOut: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Reason
            <textarea
              value={draftAdjust.reason}
              onChange={(e) =>
                setDraftAdjust((current) => ({ ...current, reason: e.target.value }))
              }
              rows={3}
              placeholder="Explain why this adjustment is needed..."
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong resize-none"
            />
          </label>
          <button
            type="button"
            onClick={handleSubmitAdjustment}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white active:scale-[0.98]"
          >
            Submit Request
          </button>
        </div>
      </Modal>
    </div>
  );
}
