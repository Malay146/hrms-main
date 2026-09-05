"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layers, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import {
  decideAllocationAction,
  upsertAllocationAction,
  type AllocationListItem,
  type AllocationListResult,
} from "@/lib/actions/people/allocations";
import type { TimeOffTypeItem } from "@/lib/actions/people/time-off-types";
import { ListPagination } from "@/components/ui/list-pagination";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

export function AllocationsClient({
  initial,
  employees,
  types,
  filterEmployeeCode,
}: {
  initial: AllocationListResult;
  employees: { id: string; employeeId: string; name: string }[];
  types: TimeOffTypeItem[];
  filterEmployeeCode?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { rows, page, total, totalPages } = initial;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const preset = useMemo(
    () => employees.find((row) => row.employeeId === filterEmployeeCode) ?? null,
    [employees, filterEmployeeCode],
  );

  function goToPage(next: number) {
    const params = new URLSearchParams();
    if (filterEmployeeCode) params.set("employeeId", filterEmployeeCode);
    if (next > 1) params.set("page", String(next));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await upsertAllocationAction({
        employeeProfileId: String(form.get("employeeProfileId") ?? ""),
        typeId: String(form.get("typeId") ?? ""),
        allocated: Number(form.get("allocated") ?? 0),
        validityYear: Number(form.get("validityYear") ?? new Date().getFullYear()),
        description: String(form.get("description") ?? "") || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("Allocation created (draft).");
      router.refresh();
    });
  }

  function decide(id: string, decision: "approved" | "refused") {
    startTransition(async () => {
      const result = await decideAllocationAction({ id, decision });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Allocation ${decision}.`);
      router.refresh();
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Time Off Allocations</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Yearly balances employees can request against.
          </p>
          {filterEmployeeCode ? (
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Filtered to{" "}
              <Link
                href={`/admin/people/employees/${filterEmployeeCode}`}
                className="underline text-zinc-900"
              >
                {filterEmployeeCode}
              </Link>
              {" · "}
              <Link href="/admin/people/leave/allocations" className="underline text-zinc-600">
                Clear
              </Link>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold"
        >
          <Plus className="size-4" />
          Add allocation
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <Layers className="size-8 text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No allocations yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Allocated</th>
                <th className="px-4 py-3">Taken</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: AllocationListItem) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-zinc-950">{row.employeeName}</p>
                    <p className="text-xs text-zinc-400">{row.employeeCode}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{row.typeName}</td>
                  <td className="px-4 py-3">{row.allocated}</td>
                  <td className="px-4 py-3">{row.taken}</td>
                  <td className="px-4 py-3 font-semibold">{row.remaining}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.validityYear}</td>
                  <td className="px-4 py-3 capitalize text-zinc-600">{row.status}</td>
                  <td className="px-4 py-3">
                    {row.status === "draft" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => decide(row.id, "approved")}
                          className="cursor-pointer text-xs font-bold text-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => decide(row.id, "refused")}
                          className="cursor-pointer text-xs font-bold text-zinc-500"
                        >
                          Refuse
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ListPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageItemCount={rows.length}
        onPageChange={goToPage}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Add allocation">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 text-left">
          <select
            name="employeeProfileId"
            required
            defaultValue={preset?.id ?? ""}
            className={inputClass}
          >
            <option value="">Employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employeeId})
              </option>
            ))}
          </select>
          <select name="typeId" required defaultValue="" className={inputClass}>
            <option value="">Type</option>
            {types
              .filter((row) => row.requiresAllocation)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
          </select>
          <input
            name="allocated"
            type="number"
            min={0.5}
            step="0.5"
            required
            defaultValue={20}
            className={inputClass}
            placeholder="Allocated"
          />
          <input
            name="validityYear"
            type="number"
            required
            defaultValue={new Date().getFullYear()}
            className={inputClass}
          />
          <input name="description" placeholder="Description" className={inputClass} />
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 text-white text-sm font-semibold"
          >
            {pending ? "Saving…" : "Create draft"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
