"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { Toast } from "@/components/ui/toast";
import { decideLeaveAction } from "@/lib/actions/people/leave";
import { summarizeLeaveForApprover } from "@/lib/actions/ai";
import type { AiLeaveBrief, LeaveListItem } from "@/lib/shared/types";

export function LeaveClient({
  initialRequests,
}: {
  initialRequests: LeaveListItem[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [commentFor, setCommentFor] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [pending, setPending] = useState(false);
  const [brief, setBrief] = useState<AiLeaveBrief | null>(null);
  const [briefLoadingId, setBriefLoadingId] = useState<string | null>(null);

  const filtered = requests.filter((req) => {
    const matchesSearch = req.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "All" || req.status === status;
    return matchesSearch && matchesStatus;
  });

  async function decide() {
    if (!commentFor) return;
    setPending(true);
    const result = await decideLeaveAction({
      leaveId: commentFor.id,
      decision: commentFor.decision,
      adminComment: comment,
    });
    setPending(false);
    if (!result.ok) {
      setToast({ message: result.error, type: "error" });
      return;
    }
    setRequests((prev) =>
      prev.map((req) =>
        req.id === commentFor.id
          ? { ...req, status: commentFor.decision[0].toUpperCase() + commentFor.decision.slice(1), adminComment: comment }
          : req,
      ),
    );
    setCommentFor(null);
    setComment("");
    setToast({ message: `Leave ${commentFor.decision}.`, type: "success" });
  }

  async function summarize(leaveId: string) {
    setBriefLoadingId(leaveId);
    const result = await summarizeLeaveForApprover(leaveId);
    setBriefLoadingId(null);
    if (!result.ok) {
      setToast({ message: result.error, type: "error" });
      return;
    }
    setBrief(result.data);
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">Time Off Requests</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Approve or refuse requests driven by types and allocations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="size-4 absolute left-3 top-3 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee" className="h-10 w-full pl-9 border border-border rounded-lg text-sm" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm">
          {["All", "Pending", "Approved", "Rejected"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Employee</th>
              <th className="py-3.5 px-6">Type</th>
              <th className="py-3.5 px-6">Duration</th>
              <th className="py-3.5 px-6">From</th>
              <th className="py-3.5 px-6">To</th>
              <th className="py-3.5 px-6">Status</th>
              <th className="py-3.5 px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm font-medium text-zinc-400">No leave requests found</td>
              </tr>
            ) : (
              filtered.map((req) => (
                <tr key={req.id} className="hover:bg-zinc-50/50">
                  <td className="py-3.5 px-6">
                    <p className="font-semibold text-zinc-900">{req.name}</p>
                    <p className="text-xs text-zinc-400">{req.department}</p>
                  </td>
                  <td className="py-3.5 px-6">{req.leaveType}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{req.duration}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{req.from}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{req.to}</td>
                  <td className="py-3.5 px-6">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      req.status === "Approved" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                      req.status === "Pending" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      req.status === "Rejected" && "bg-red-50 text-red-700 border-red-200/50",
                    )}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-6">
                    {req.status === "Pending" ? (
                      <div className="flex gap-2">
                        <button onClick={() => { setCommentFor({ id: req.id, decision: "approved" }); setComment(""); }} className="cursor-pointer px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/50">
                          Approve
                        </button>
                        <button onClick={() => { setCommentFor({ id: req.id, decision: "rejected" }); setComment(""); }} className="cursor-pointer px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200/50">
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => summarize(req.id)}
                          disabled={briefLoadingId === req.id}
                          className="cursor-pointer px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-surface-hover text-xs font-semibold disabled:opacity-50"
                        >
                          {briefLoadingId === req.id ? "Summarizing…" : "Summarize"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">{req.adminComment ?? "—"}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {commentFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-border rounded-2xl p-6 bg-surface flex flex-col gap-4">
            <h2 className="text-h3 font-semibold">
              {commentFor.decision === "approved" ? "Approve leave" : "Reject leave"}
            </h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Admin comment (required)"
              className="h-24 p-3 border border-border rounded-lg text-sm resize-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCommentFor(null)} className="cursor-pointer px-3 py-2 border border-border rounded-lg text-sm font-semibold">
                Cancel
              </button>
              <button disabled={pending || !comment.trim()} onClick={decide} className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50">
                {pending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {brief && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-border rounded-2xl p-6 bg-surface flex flex-col gap-4">
            <h2 className="text-h3 font-semibold">Leave brief</h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Suggestion: {brief.suggestion} · {brief.clashCount} team clash(es)
            </p>
            <ul className="flex flex-col gap-2 text-sm text-zinc-700 font-medium">
              {brief.bullets.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <p className="text-xs text-zinc-400">Advisory only. Approve or reject still requires your comment.</p>
            <div className="flex justify-end">
              <button onClick={() => setBrief(null)} className="cursor-pointer px-3 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-surface-hover">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
