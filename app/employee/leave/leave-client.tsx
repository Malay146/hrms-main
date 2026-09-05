"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { Toast } from "@/components/ui/toast";
import { AttendanceCalendar } from "@/components/leave/attendance-calendar";
import { applyLeaveAction } from "@/lib/actions/people/leave";
import { kolkataTodayKey } from "@/lib/shared/dates";
import type { CalendarMarker, LeaveListItem, LeaveType } from "@/lib/shared/types";

export function EmployeeLeaveClient({
  initialRequests,
  markers,
  balances,
  options,
}: {
  initialRequests: LeaveListItem[];
  markers: CalendarMarker[];
  balances: { paid: number; paidTotal: number; sickUsed: number; unpaidUsed: number };
  options: {
    types: { id: string; code: string; name: string; requiresAllocation: boolean }[];
    allocations: {
      id: string;
      typeId: string;
      typeName: string;
      remaining: number;
      validityYear: number;
    }[];
  };
}) {
  const [requests, setRequests] = useState(initialRequests);
  const defaultType = (options.types.find((t) => t.code === "paid")?.code ??
    options.types[0]?.code ??
    "paid") as LeaveType;
  const [type, setType] = useState<LeaveType>(defaultType);
  const [allocationId, setAllocationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectedType = options.types.find((row) => row.code === type);
  const matchingAllocations = options.allocations.filter(
    (row) => row.typeId === selectedType?.id,
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await applyLeaveAction({
      type,
      startDate: from,
      endDate: to,
      remarks: reason,
      allocationId: allocationId || null,
    });
    setPending(false);
    if (!result.ok) {
      setToast({ message: result.error, type: "error" });
      return;
    }
    setRequests((prev) => [result.data, ...prev]);
    setReason("");
    setToast({ message: "Leave request submitted.", type: "success" });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">My Leave Requests</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Request leaves, track approvals, and view your remaining balances.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Paid Leave", value: `${balances.paid} / ${balances.paidTotal} Days`, percent: (balances.paid / balances.paidTotal) * 100, color: "bg-zinc-950" },
          { label: "Sick used", value: `${balances.sickUsed} Days`, percent: Math.min(100, balances.sickUsed * 10), color: "bg-zinc-600" },
          { label: "Unpaid used", value: `${balances.unpaidUsed} Days`, percent: Math.min(100, balances.unpaidUsed * 10), color: "bg-zinc-400" },
        ].map((bal) => (
          <div key={bal.label} className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-500">{bal.label}</span>
              <span className="text-sm font-bold text-zinc-900">{bal.value}</span>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full", bal.color)} style={{ width: `${bal.percent}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 border border-border rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-bold text-zinc-950">New Leave Request</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as LeaveType);
                setAllocationId("");
              }}
              className="h-10 px-3 border border-border rounded-lg text-sm"
            >
              {(options.types.length
                ? options.types
                : [
                    { code: "paid", name: "Paid Leave" },
                    { code: "sick", name: "Sick Leave" },
                    { code: "unpaid", name: "Unpaid Leave" },
                  ]
              ).map((row) => (
                <option key={row.code} value={row.code}>
                  {row.name}
                </option>
              ))}
            </select>
            {selectedType?.requiresAllocation ? (
              <select
                value={allocationId}
                onChange={(e) => setAllocationId(e.target.value)}
                required
                className="h-10 px-3 border border-border rounded-lg text-sm"
              >
                <option value="">Select allocation</option>
                {matchingAllocations.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.typeName} · {row.remaining} left ({row.validityYear})
                  </option>
                ))}
              </select>
            ) : null}
            <input type="date" min={type === "sick" ? undefined : kolkataTodayKey()} value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm" required />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm" required />
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for leave..." className="h-20 p-3 border border-border rounded-lg text-sm resize-none" />
            <button disabled={pending} className="cursor-pointer h-10 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800">
              {pending ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="border border-border rounded-xl p-5">
            <AttendanceCalendar
              markers={markers}
              from={from}
              to={to}
              onRangeChange={(nextFrom, nextTo) => {
                setFrom(nextFrom);
                setTo(nextTo);
              }}
            />
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-zinc-50/85 border-b text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-sm font-medium text-zinc-400">No leave requests yet</td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.id}>
                      <td className="py-3.5 px-4 font-bold">{req.leaveType}</td>
                      <td className="py-3.5 px-4 text-zinc-500">{req.from} - {req.to}</td>
                      <td className="py-3.5 px-4 text-zinc-500">{req.remarks}</td>
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                          req.status === "Approved" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                          req.status === "Pending" && "bg-amber-50 text-amber-700 border-amber-200/50",
                          req.status === "Rejected" && "bg-red-50 text-red-700 border-red-200/50",
                        )}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
