"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import {
  deleteTimeOffTypeAction,
  upsertTimeOffTypeAction,
  type TimeOffTypeItem,
} from "@/lib/actions/people/time-off-types";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

export function TimeOffTypesClient({ initialTypes }: { initialTypes: TimeOffTypeItem[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [editing, setEditing] = useState<TimeOffTypeItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TimeOffTypeItem | null>(null);
  const [pending, startTransition] = useTransition();

  const formOpen = creating || Boolean(editing);

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await upsertTimeOffTypeAction({
        id: editing?.id,
        name: String(form.get("name") ?? ""),
        code: String(form.get("code") ?? ""),
        unit: String(form.get("unit") ?? "days") as "days" | "hours",
        requiresAllocation: form.get("requiresAllocation") === "on",
        approver: String(form.get("approver") ?? "manager") as "manager" | "officer",
        color: editing?.color ?? "zinc",
        payrollNote: String(form.get("payrollNote") ?? "") || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTypes((prev) =>
        [...prev.filter((row) => row.id !== result.data.id), result.data].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      closeForm();
      toast.success(editing ? `Updated ${result.data.name}.` : `Created ${result.data.name}.`);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteTimeOffTypeAction({ id: deleteTarget.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTypes((prev) => prev.filter((row) => row.id !== result.data.id));
      setDeleteTarget(null);
      toast.success("Type deleted.");
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
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
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
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Allocation</th>
                <th className="px-4 py-3">Approver</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold text-zinc-950">{row.name}</td>
                  <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{row.unit}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {row.requiresAllocation ? "Required" : "Not required"}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{row.approver}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setCreating(false);
                          setEditing(row);
                        }}
                        className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-950"
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="cursor-pointer inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? "Edit time off type" : "Add time off type"}
        description={editing ? editing.code : undefined}
      >
        <form
          key={editing?.id ?? "create"}
          onSubmit={handleSave}
          className="flex flex-col gap-3 text-left"
        >
          <input
            name="name"
            required
            defaultValue={editing?.name}
            placeholder="Name"
            className={inputClass}
          />
          <input
            name="code"
            required
            defaultValue={editing?.code}
            placeholder="code_like_this"
            className={inputClass}
          />
          <select name="unit" defaultValue={editing?.unit ?? "days"} className={inputClass}>
            <option value="days">Days</option>
            <option value="hours">Hours</option>
          </select>
          <select
            name="approver"
            defaultValue={editing?.approver ?? "manager"}
            className={inputClass}
          >
            <option value="manager">Manager</option>
            <option value="officer">Officer</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              name="requiresAllocation"
              defaultChecked={editing?.requiresAllocation ?? true}
              className="size-4"
            />
            Requires allocation
          </label>
          <input
            name="payrollNote"
            defaultValue={editing?.payrollNote ?? ""}
            placeholder="Payroll note (optional)"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Saving…" : editing ? "Save changes" : "Create"}
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete time off type"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.name} (${deleteTarget.code}) permanently.`
            : undefined
        }
      >
        {deleteTarget ? (
          <div className="flex flex-col gap-4 text-left">
            <p className="text-sm text-zinc-600">
              Types used by existing leave requests cannot be deleted. Unused allocations for this
              type will be removed.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer h-10 px-3 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="cursor-pointer h-10 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
