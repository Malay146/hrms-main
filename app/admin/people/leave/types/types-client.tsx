"use client";

import { useState, useTransition } from "react";
import { Plus, Tags } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import {
  upsertTimeOffTypeAction,
  type TimeOffTypeItem,
} from "@/lib/actions/people/time-off-types";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

export function TimeOffTypesClient({ initialTypes }: { initialTypes: TimeOffTypeItem[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await upsertTimeOffTypeAction({
        name: String(form.get("name") ?? ""),
        code: String(form.get("code") ?? ""),
        unit: String(form.get("unit") ?? "days") as "days" | "hours",
        requiresAllocation: form.get("requiresAllocation") === "on",
        approver: String(form.get("approver") ?? "manager") as "manager" | "officer",
        color: "zinc",
        payrollNote: String(form.get("payrollNote") ?? "") || null,
      });
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setTypes((prev) =>
        [...prev.filter((row) => row.id !== result.data.id), result.data].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setOpen(false);
      setToast({ message: `Saved ${result.data.name}.`, type: "success" });
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Time Off Types</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Paid, sick, unpaid, and other leave categories.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold"
        >
          <Plus className="size-4" />
          Add type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <Tags className="size-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No types yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Allocation</th>
                <th className="px-4 py-3">Approver</th>
              </tr>
            </thead>
            <tbody>
              {types.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold text-zinc-950">{row.name}</td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{row.unit}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {row.requiresAllocation ? "Required" : "Not required"}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{row.approver}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add time off type">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 text-left">
          <input name="name" required placeholder="Name" className={inputClass} />
          <input name="code" required placeholder="code_like_this" className={inputClass} />
          <select name="unit" defaultValue="days" className={inputClass}>
            <option value="days">Days</option>
            <option value="hours">Hours</option>
          </select>
          <select name="approver" defaultValue="manager" className={inputClass}>
            <option value="manager">Manager</option>
            <option value="officer">Officer</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input type="checkbox" name="requiresAllocation" defaultChecked className="size-4" />
            Requires allocation
          </label>
          <input name="payrollNote" placeholder="Payroll note (optional)" className={inputClass} />
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 text-white text-sm font-semibold"
          >
            {pending ? "Saving…" : "Create"}
          </button>
        </form>
      </Modal>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
