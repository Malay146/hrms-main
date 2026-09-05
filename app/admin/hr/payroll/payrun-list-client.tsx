"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { PayrunListItem } from "@/lib/actions/payroll/payruns";
import type { SalaryStructureListItem } from "@/lib/actions/payroll/salary";
import { PayrunWizard } from "./payrun-wizard";

export function PayrunListClient({
  payruns,
  structures,
  canEdit,
}: {
  payruns: PayrunListItem[];
  structures: SalaryStructureListItem[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Payruns</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Create a payrun in two steps, then compute, validate, and mark it paid.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2 inline-flex items-center gap-2"
          >
            <Plus className="size-4" />
            New payrun
          </button>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
            Read only
          </span>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Payrun</th>
              <th className="py-3.5 px-4">Period</th>
              <th className="py-3.5 px-4">Structure</th>
              <th className="py-3.5 px-4">Employees</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Warnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payruns.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No payruns yet
                </td>
              </tr>
            ) : (
              payruns.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 px-6">
                    <Link href={`/admin/hr/payroll/${row.id}`} className="font-semibold text-zinc-900">
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    {row.periodStart} — {row.periodEnd}
                  </td>
                  <td className="py-3 px-4">{row.structureName}</td>
                  <td className="py-3 px-4">{row.employeeCount}</td>
                  <td className="py-3 px-4 capitalize">{row.status}</td>
                  <td className="py-3 px-4">{row.warningCount || "No warnings"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <PayrunWizard structures={structures} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}
