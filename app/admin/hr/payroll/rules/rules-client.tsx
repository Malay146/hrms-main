"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteSalaryRuleAction,
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

function formFromRule(rule: SalaryRuleListItem) {
  return {
    name: rule.name,
    code: rule.code,
    category: rule.category,
    sequence: rule.sequence,
    computation: rule.computation,
    amount: rule.amount ?? 0,
    percentage: rule.percentage ?? 0,
    percentBaseCode: rule.percentBaseCode ?? "",
    formula: rule.formula ?? "",
  };
}

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
  const [form, setForm] = useState(() => (selected ? formFromRule(selected) : emptyRule));
  const [currentStructureId, setCurrentStructureId] = useState(
    selected?.structureId || structureId || structures[0]?.id || "",
  );

  useEffect(() => {
    setForm(selected ? formFromRule(selected) : emptyRule);
    setCurrentStructureId(selected?.structureId || structureId || structures[0]?.id || "");
  }, [selected?.id, selected?.structureId, structureId, structures[0]?.id]);

  function openRule(rule: SalaryRuleListItem) {
    router.push(`/admin/hr/payroll/rules?structureId=${rule.structureId}&id=${rule.id}`);
  }

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
      toast.success(id ? "Salary rule updated" : "Salary rule created");
      router.push(`/admin/hr/payroll/rules?structureId=${currentStructureId}&id=${result.data.id}`);
      router.refresh();
    });
  }

  function remove(rule: SalaryRuleListItem) {
    if (!window.confirm(`Delete salary rule “${rule.name}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteSalaryRuleAction(rule.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${rule.name}.`);
      const next =
        selected?.id === rule.id
          ? `/admin/hr/payroll/rules?structureId=${rule.structureId}`
          : `/admin/hr/payroll/rules?structureId=${structureId || rule.structureId}${selected ? `&id=${selected.id}` : ""}`;
      router.push(next);
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
        {canEdit ? (
          <button
            type="button"
            onClick={() =>
              router.push(
                `/admin/hr/payroll/rules${currentStructureId ? `?structureId=${currentStructureId}` : ""}`,
              )
            }
            className="cursor-pointer rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2 inline-flex items-center gap-2"
          >
            <Plus className="size-4" />
            New rule
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
              <th className="py-3.5 px-4">Seq</th>
              <th className="py-3.5 px-4">Name</th>
              <th className="py-3.5 px-4">Code</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Structure</th>
              {canEdit ? <th className="py-3.5 px-4 text-right"> </th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No salary rules yet
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={selected?.id === rule.id ? "bg-zinc-50" : "hover:bg-zinc-50/50"}
                >
                  <td className="py-3 px-4">{rule.sequence}</td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => openRule(rule)}
                      className="cursor-pointer font-semibold text-zinc-900 text-left"
                    >
                      {rule.name}
                    </button>
                  </td>
                  <td className="py-3 px-4">{rule.code}</td>
                  <td className="py-3 px-4 capitalize">{rule.category}</td>
                  <td className="py-3 px-4">{rule.structureName}</td>
                  {canEdit ? (
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openRule(rule)}
                        className="cursor-pointer px-2 py-1 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-surface-hover"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(rule)}
                        className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-error hover:bg-error-soft/50 disabled:opacity-60"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border border-border rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 text-h3 font-semibold">{selected ? `Edit ${selected.name}` : "New rule"}</h2>
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
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            {selected ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(selected)}
                className="cursor-pointer px-3.5 py-2 rounded-lg border border-error/30 bg-error-soft/40 text-sm font-semibold text-error hover:bg-error-soft disabled:opacity-60"
              >
                Delete rule
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => save(selected?.id)}
              className="cursor-pointer w-fit rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
            >
              {pending ? "Saving..." : selected ? "Save changes" : "Save rule"}
            </button>
          </div>
        ) : null}
        {selected ? (
          <p className="md:col-span-2 text-xs text-zinc-400">
            Editing in {selected.structureName}.{" "}
            <Link href={`/admin/hr/payroll/structures?id=${selected.structureId}`} className="font-semibold text-zinc-600 underline">
              Open structure
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
