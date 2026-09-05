"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Toast } from "@/components/ui/toast";
import {
  deleteContractAction,
  upsertContractAction,
  type ContractFormOptions,
  type ContractListItem,
} from "@/lib/actions/people/contracts";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

export function ContractDetailClient({
  contract,
  options,
}: {
  contract: ContractListItem;
  options: ContractFormOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  const [departmentId, setDepartmentId] = useState(contract.departmentId ?? "");
  const [scheduleId, setScheduleId] = useState(contract.scheduleId ?? "");
  const [salaryStructureId, setSalaryStructureId] = useState(
    contract.salaryStructureId ?? "",
  );
  const [jobTitle, setJobTitle] = useState(contract.jobTitle);
  const [wage, setWage] = useState(String(contract.wage));
  const [startDate, setStartDate] = useState(contract.startDate);
  const [endDate, setEndDate] = useState(contract.endDate ?? "");
  const [status, setStatus] = useState<"running" | "expired">(contract.status);
  const [notes, setNotes] = useState(contract.notes ?? "");

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertContractAction({
        id: contract.id,
        employeeProfileId: contract.employeeProfileId,
        departmentId: departmentId || null,
        scheduleId: scheduleId || null,
        salaryStructureId: salaryStructureId || null,
        jobTitle,
        wage: Number(wage),
        startDate,
        endDate: endDate || null,
        status,
        notes: notes || null,
      });
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setToast({ message: `Saved ${result.data.code}.`, type: "success" });
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete contract ${contract.code}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteContractAction(contract.id);
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      router.push("/admin/people/contracts");
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/people/contracts"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 font-semibold"
        >
          <ArrowLeft className="size-4" />
          Back to Contracts
        </Link>
        <Link
          href={`/admin/people/employees/${contract.employeeCode}`}
          className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 underline"
        >
          Open employee
        </Link>
      </div>

      <div>
        <h1 className="text-h1 font-medium">{contract.code}</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          {contract.employeeName} · {contract.employeeCode}
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Position</span>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Wage / month</span>
          <input
            type="number"
            min={1}
            step="0.01"
            value={wage}
            onChange={(e) => setWage(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Department</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {options.departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Schedule</span>
          <select
            value={scheduleId}
            onChange={(e) => setScheduleId(e.target.value)}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {options.schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Salary structure</span>
          <select
            value={salaryStructureId}
            onChange={(e) => setSalaryStructureId(e.target.value)}
            className={inputClass}
          >
            <option value="">Optional</option>
            {options.salaryStructures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-zinc-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "running" | "expired")}
            className={inputClass}
          >
            <option value="running">Running</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-semibold text-zinc-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong resize-y"
          />
        </label>
        <div className="sm:col-span-2 flex justify-between gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="cursor-pointer px-3.5 py-2 rounded-lg border border-error/30 bg-error-soft/40 text-sm font-semibold text-error hover:bg-error-soft disabled:opacity-60"
          >
            Delete contract
          </button>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}
