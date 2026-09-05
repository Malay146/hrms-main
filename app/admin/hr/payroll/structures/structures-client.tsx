"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSalaryStructureAction, type SalaryRuleListItem, type SalaryStructureListItem } from "@/lib/actions/salary";

type Selected = SalaryStructureListItem & { rules: SalaryRuleListItem[] };

export function StructuresClient({
  structures,
  selected,
  canEdit,
}: {
  structures: SalaryStructureListItem[];
  selected: Selected | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(selected?.name ?? "");
  const [active, setActive] = useState(selected?.active ?? true);

  function save(id?: string) {
    startTransition(async () => {
      const result = await saveSalaryStructureAction({ id, name, active });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Salary structure saved");
      router.push(`/admin/hr/payroll/structures?id=${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Salary Structures</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            A structure is the ordered set of salary rules used by a payrun.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setName("");
              setActive(true);
              router.push("/admin/hr/payroll/structures");
            }}
            className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
          >
            New structure
          </button>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
            Read only
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="py-3.5 px-4">Structure</th>
                <th className="py-3.5 px-4">Rules</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {structures.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-sm text-zinc-400">
                    No structures yet
                  </td>
                </tr>
              ) : (
                structures.map((row) => (
                  <tr key={row.id} className={selected?.id === row.id ? "bg-zinc-50" : undefined}>
                    <td className="py-3 px-4">
                      <Link href={`/admin/hr/payroll/structures?id=${row.id}`} className="font-semibold text-zinc-900">
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4">{row.ruleCount} rules</td>
                    <td className="py-3 px-4">{row.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-7 border border-border rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-h3 font-semibold">{selected ? selected.name : "New structure"}</h2>
          <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="h-10 px-3 border border-border rounded-lg text-sm disabled:bg-zinc-50"
            />
          </label>
          <label className="text-sm font-semibold text-zinc-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              disabled={!canEdit}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(selected?.id)}
              className="w-fit rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          ) : null}

          {selected ? (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-900">Salary rules</h3>
                <Link href={`/admin/hr/payroll/rules?structureId=${selected.id}`} className="text-sm font-semibold text-zinc-500">
                  Open rules
                </Link>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-zinc-500">
                    <th className="py-2">Seq</th>
                    <th className="py-2">Rule</th>
                    <th className="py-2">Code</th>
                    <th className="py-2">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selected.rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="py-2">{rule.sequence}</td>
                      <td className="py-2 font-medium">{rule.name}</td>
                      <td className="py-2">{rule.code}</td>
                      <td className="py-2 capitalize">{rule.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
