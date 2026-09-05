"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { upsertPayrollAction } from "@/lib/actions/payroll/payroll";
import { currentPayrollMonth } from "@/lib/shared/dates";
import type { PayrollListItem } from "@/lib/shared/types";
import { ListPagination, useClientPagination } from "@/components/ui/list-pagination";

export function PayrollClient({
  initialRows,
  canEdit,
}: {
  initialRows: PayrollListItem[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const month = currentPayrollMonth();
  const {
    page,
    setPage,
    totalPages,
    total,
    pageItems: pagedRows,
  } = useClientPagination(rows, 20);

  async function save(row: PayrollListItem) {
    setSavingId(row.userId);
    const result = await upsertPayrollAction({
      userId: row.userId,
      month: row.month || month,
      basic: Number(row.basic),
      hraPct: Number(row.hraPct),
      allowancePct: Number(row.allowancePct),
      deductions: Number(row.deductions),
    });
    setSavingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRows((prev) => prev.map((item) => (item.userId === row.userId ? result.data : item)));
    toast.success(`Saved payroll for ${row.name}`);
  }

  const totalNet = rows.reduce((sum, row) => sum + Number(row.netSalary || 0), 0);

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 font-medium">Payroll</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Edit salary structure. Net pay is generated as basic + HRA + allowance − deductions.
          </p>
        </div>
        {canEdit ? (
          <button className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98">
            <Play className="size-4" />
            Run Payroll
          </button>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
            Read only
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-zinc-500">Employees</p>
          <p className="text-2xl font-bold text-zinc-950 mt-2">{rows.length}</p>
        </div>
        <div className="border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-zinc-500">Month</p>
          <p className="text-2xl font-bold text-zinc-950 mt-2">{month}</p>
        </div>
        <div className="border border-border rounded-xl p-5">
          <p className="text-sm font-medium text-zinc-500">Total net</p>
          <p className="text-2xl font-bold text-zinc-950 mt-2">₹{totalNet.toLocaleString()}</p>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Employee</th>
              <th className="py-3.5 px-4">Basic</th>
              <th className="py-3.5 px-4">HRA %</th>
              <th className="py-3.5 px-4">Allowance %</th>
              <th className="py-3.5 px-4">Deductions</th>
              <th className="py-3.5 px-4">Net</th>
              <th className="py-3.5 px-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No payroll rows yet
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => (
                <tr key={row.userId}>
                  <td className="py-3 px-6">
                    <p className="font-semibold text-zinc-900">{row.name}</p>
                    <p className="text-xs text-zinc-400">{row.employeeId}</p>
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={row.basic}
                      disabled={!canEdit}
                      onChange={(e) => setRows((prev) => prev.map((item) => item.userId === row.userId ? { ...item, basic: Number(e.target.value) } : item))}
                      className="h-10 w-28 px-2 border border-border rounded-lg text-sm disabled:bg-zinc-50"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={row.hraPct}
                      disabled={!canEdit}
                      onChange={(e) => setRows((prev) => prev.map((item) => item.userId === row.userId ? { ...item, hraPct: Number(e.target.value) } : item))}
                      className="h-10 w-20 px-2 border border-border rounded-lg text-sm disabled:bg-zinc-50"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={row.allowancePct}
                      disabled={!canEdit}
                      onChange={(e) => setRows((prev) => prev.map((item) => item.userId === row.userId ? { ...item, allowancePct: Number(e.target.value) } : item))}
                      className="h-10 w-20 px-2 border border-border rounded-lg text-sm disabled:bg-zinc-50"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={row.deductions}
                      disabled={!canEdit}
                      onChange={(e) => setRows((prev) => prev.map((item) => item.userId === row.userId ? { ...item, deductions: Number(e.target.value) } : item))}
                      className="h-10 w-28 px-2 border border-border rounded-lg text-sm disabled:bg-zinc-50"
                    />
                  </td>
                  <td className="py-3 px-4 font-semibold">₹{Number(row.netSalary || 0).toLocaleString()}</td>
                  <td className="py-3 px-6">
                    {canEdit ? (
                      <button
                        onClick={() => save(row)}
                        disabled={savingId === row.userId}
                        className="cursor-pointer px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold"
                      >
                        {savingId === row.userId ? "Saving..." : "Save"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ListPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageItemCount={pagedRows.length}
        onPageChange={setPage}
      />
    </div>
  );
}
