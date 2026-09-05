"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPayrunAction, listEligibleEmployees, type EligibleEmployee } from "@/lib/actions/payruns";
import type { SalaryStructureListItem } from "@/lib/actions/salary";

type EmployeeType = "full_time" | "intern" | "contractor";

export function PayrunWizard({
  structures,
  onClose,
}: {
  structures: SalaryStructureListItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [structureId, setStructureId] = useState(structures[0]?.id ?? "");
  const [periodStart, setPeriodStart] = useState("2026-01-01");
  const [periodEnd, setPeriodEnd] = useState("2026-01-31");
  const [employeeType, setEmployeeType] = useState<EmployeeType | "">("");
  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, value]) => value).map(([id]) => id),
    [selected],
  );

  function continueToEmployees() {
    startTransition(async () => {
      const result = await listEligibleEmployees({
        employeeType: employeeType || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEmployees(result.data);
      setSelected(Object.fromEntries(result.data.map((row) => [row.id, true])));
      setStep(2);
    });
  }

  function create() {
    startTransition(async () => {
      const result = await createPayrunAction({
        name: name || `Payrun ${periodStart}`,
        structureId,
        periodStart,
        periodEnd,
        employeeType: employeeType || null,
        employeeIds: selectedIds,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payrun created");
      onClose();
      router.push(`/admin/hr/payroll/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-auto border border-border rounded-2xl bg-surface p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-h3 font-semibold">New pay run</h2>
            <p className="text-sm text-zinc-500 font-medium">
              {step === 1 ? "Choose structure and period. Continue does not create a record." : "Select employees, then Create Payrun."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-500">
            Close
          </button>
        </div>

        {step === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1 md:col-span-2">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm" placeholder="January 2026" />
            </label>
            <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
              Salary structure
              <select value={structureId} onChange={(e) => setStructureId(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm">
                {structures.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
              Employee type
              <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value as EmployeeType | "")} className="h-10 px-3 border border-border rounded-lg text-sm">
                <option value="">All employee types</option>
                <option value="full_time">Full time</option>
                <option value="intern">Intern</option>
                <option value="contractor">Contractor</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
              Period start
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm" />
            </label>
            <label className="text-sm font-semibold text-zinc-600 flex flex-col gap-1">
              Period end
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-10 px-3 border border-border rounded-lg text-sm" />
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold">
                Discard
              </button>
              <button
                type="button"
                disabled={pending || !structureId}
                onClick={continueToEmployees}
                className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
              >
                {pending ? "Loading..." : "Continue"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="border border-border rounded-xl overflow-x-auto max-h-[50vh]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="py-3 px-4" />
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Wage</th>
                    <th className="py-3 px-4">Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 px-4">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[row.id])}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                        />
                      </td>
                      <td className="py-2 px-4">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-xs text-zinc-400">{row.employeeId}</p>
                      </td>
                      <td className="py-2 px-4">₹{row.wage.toLocaleString("en-IN")}</td>
                      <td className="py-2 px-4">{row.hasContract ? "Ready" : "Missing"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold">
                Back
              </button>
              <button
                type="button"
                disabled={pending || selectedIds.length === 0}
                onClick={create}
                className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
              >
                {pending ? "Creating..." : "Create Payrun"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
