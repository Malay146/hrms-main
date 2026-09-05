"use client";

import React, { useState } from "react";
import { cn } from "@/utils/cn";
import { toast } from "sonner";

const formatDisplayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const calculateDuration = (from: string, to: string) => {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  return `${days} Day${days === 1 ? "" : "s"}`;
};

const initialMyRequests = [
  {
    id: "L-001",
    type: "Sick Leave",
    duration: "2 Days",
    dates: "12 Jul - 14 Jul 2026",
    reason: "Medical checkup",
    status: "Approved",
  },
  {
    id: "L-002",
    type: "Annual Leave",
    duration: "5 Days",
    dates: "10 Aug - 15 Aug 2026",
    reason: "Family vacation",
    status: "Pending",
  },
  {
    id: "L-003",
    type: "Casual Leave",
    duration: "1 Day",
    dates: "18 Jun - 18 Jun 2026",
    reason: "Urgent personal work",
    status: "Rejected",
  },
];

export default function EmployeeLeavePage() {
  const [requests, setRequests] = useState(initialMyRequests);
  const [leaveType, setLeaveType] = useState("Annual Leave");
  const [from, setFrom] = useState("2026-08-10");
  const [to, setTo] = useState("2026-08-15");
  const [reason, setReason] = useState("");

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !from || !to) return;

    const duration = calculateDuration(from, to);
    const dates =
      from === to
        ? formatDisplayDate(from)
        : `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`;

    const newReq = {
      id: `L-${Date.now().toString().slice(-3)}`,
      type: leaveType,
      duration,
      dates,
      reason: reason.trim(),
      status: "Pending",
    };
    setRequests((prev) => [newReq, ...prev]);
    setReason("");
    toast.success("Leave request submitted", {
      description: `${leaveType} for ${duration} sent for approval.`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Pending":
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case "Rejected":
      default:
        return "bg-red-50 text-red-700 border border-red-200/50";
    }
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col text-left">
          <h1 className="type-title">My Leave Requests</h1>
          <p className="type-subtitle">
            Request leaves, track approvals, and view your remaining balances.
          </p>
        </div>
      </div>

      {/* Leave Balance Trackers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left select-none">
        {[
          {
            label: "Annual Leave",
            value: "15 / 20 Days",
            percent: 75,
            color: "bg-zinc-950",
          },
          {
            label: "Sick Leave",
            value: "8 / 10 Days",
            percent: 80,
            color: "bg-zinc-600",
          },
          {
            label: "Casual Leave",
            value: "6 / 12 Days",
            percent: 50,
            color: "bg-zinc-400",
          },
        ].map((bal, idx) => (
          <div
            key={idx}
            className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between gap-3"
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-500">
                {bal.label}
              </span>
              <span className="text-sm font-bold text-zinc-900">
                {bal.value}
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", bal.color)}
                style={{ width: `${bal.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Request Form */}
        <div className="lg:col-span-4 border border-border rounded-xl p-5 bg-surface flex flex-col gap-4 text-left">
          <h2 className="type-heading">
            New Leave Request
          </h2>
          <form onSubmit={handleRequestSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-700">
                Leave Type
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong font-medium cursor-pointer"
              >
                <option>Annual Leave</option>
                <option>Sick Leave</option>
                <option>Casual Leave</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-700">
                From Date
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-700">
                To Date
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-700">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason for leave..."
                className="h-20 p-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong font-medium resize-none"
              />
            </div>
            <button
              type="submit"
              className="cursor-pointer h-10 w-full mt-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 flex items-center justify-center shrink-0 active:scale-98 transition-all"
            >
              Submit Request
            </button>
          </form>
        </div>

        {/* Right Column: Request Logs */}
        <div className="lg:col-span-8 flex flex-col gap-4 text-left">
          <h2 className="type-heading">
            My Request History
          </h2>
          <div className="border border-border rounded-xl bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-50/85 border-b border-border text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-zinc-700 font-semibold">
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-zinc-50/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-zinc-950">
                        {req.type}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500">
                        {req.duration}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-450">{req.dates}</td>
                      <td className="py-3.5 px-4 text-zinc-550 truncate max-w-[120px]">
                        {req.reason}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            "whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
                            getStatusBadge(req.status),
                          )}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
