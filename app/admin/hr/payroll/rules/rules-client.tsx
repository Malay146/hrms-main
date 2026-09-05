"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  saveSalaryRuleAction,
  type SalaryRuleListItem,
  type SalaryStructureListItem,
} from "@/lib/actions/payroll/salary";
import type { RuleComputation, SalaryCategory } from "@/lib/payroll/compute";

const CATEGORIES: SalaryCategory[] = ["basic", "allowance", "gross", "deduction", "net", "contribution"];
const COMPUTATIONS: RuleComputation[] = [
  "fixed",
  "percent_of_wage",
  "percent_of_basic",
  "percent_of_gross",
  "percent_of_category",
  "formula",
];

const emptyRule = {
  name: "",
  code: "",
  category: "allowance" as SalaryCategory,
  sequence: 10,
  computation: "fixed" as RuleComputation,
  amount: 0,
  percentage: 0,
  percentBaseCode: "",
  formula: "",
};

export function RulesClient({
  structures,
  rules,
  selected,
  structureId,
  canEdit,
}: {
  structures: SalaryStructureListItem[];
  rules: SalaryRuleListItem[];
  selected: SalaryRuleListItem | null;
  structureId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() =>
    selected
      ? {
          name: selected.name,
          code: selected.code,
          category: selected.category,
          sequence: selected.sequence,
          computation: selected.computation,
          amount: selected.amount ?? 0,
          percentage: selected.percentage ?? 0,
          percentBaseCode: selected.percentBaseCode ?? "",
          formula: selected.formula ?? "",
        }
      : emptyRule,
  );
  const [currentStructureId, setCurrentStructureId] = useState(selected?.structureId || structureId || structures[0]?.id || "");

  function save(id?: string) {
    startTransition(async () => {
      const result = await saveSalaryRuleAction({
        id,
        structureId: currentStructureId,
        ...form,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Salary rule saved");
      router.push(`/admin/hr/payroll/rules?structureId=${currentStructureId}&id=${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Salary Rules</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Sequence matters. Fixed amount, percent of wage/basic/gross, or a sandboxed formula.
          </p>
        </div>
        {canEdit ? null : (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
            Read only
          </span>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-4">Seq</th>
              <th className="py-3.5 px-4">Name</th>
              <th className="py-3.5 px-4">Code</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Structure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="py-3 px-4">{rule.sequence}</td>
                <td className="py-3 px-4">
                  <Link className="font-semibold text-zinc-900" href={`/admin/hr/payroll/rules?structureId=${rule.structureId}&id=${rule.id}`}>
                    {rule.name}
                  </Link>
                </td>
                <td className="py-3 px-4">{rule.code}</td>
                <td className="py-3 px-4 capitalize">{rule.category}</td>
                <td className="py-3 px-4">{rule.structureName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-border rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 text-h3 font-semibold">{selected ? selected.name : "New rule"}</h2>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Structure
          <select
            value={currentStructureId}
            disabled={!canEdit}
            onChange={(e) => setCurrentStructureId(e.target.value)}
            className="h-10 px-3 border border-border rounded-lg text-sm"
          >
            {structures.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Name
          <input className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Code
          <input className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Sequence
          <input type="number" className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.sequence} onChange={(e) => setForm({ ...form, sequence: Number(e.target.value) })} />
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Category
          <select className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SalaryCategory })}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Computation
          <select className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.computation} onChange={(e) => setForm({ ...form, computation: e.target.value as RuleComputation })}>
            {COMPUTATIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Amount (fixed)
          <input type="number" className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Percentage
          <input type="number" className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.percentage} onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })} />
        </label>
        <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Percent base code
          <input className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.percentBaseCode} onChange={(e) => setForm({ ...form, percentBaseCode: e.target.value })} />
        </label>
        <label className="md:col-span-2 text-sm font-semibold text-zinc-600 flex flex-col gap-1">
          Formula
          <input className="h-10 px-3 border border-border rounded-lg text-sm" disabled={!canEdit} value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} />
        </label>
        <p className="md:col-span-2 text-xs text-zinc-500 font-medium">
          Computation note: Fixed uses the amount. Percentage uses wage, basic, gross, or another rule code. Formula may use wage, workedDays, scheduledDays, unpaidLeaveDays, categories.*, and byCode['CODE'].
        </p>
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(selected?.id)}
            className="w-fit rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
          >
            {pending ? "Saving..." : "Save rule"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
