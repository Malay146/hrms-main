"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import {
  deleteContractAction,
  upsertContractAction,
  type ContractFormOptions,
  type ContractListItem,
  type ContractListResult,
} from "@/lib/actions/people/contracts";
import { ListPagination } from "@/components/ui/list-pagination";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

export function ContractsClient({
  initial,
  options,
  filterEmployeeCode,
  query,
}: {
  initial: ContractListResult;
  options: ContractFormOptions;
  filterEmployeeCode?: string | null;
  query: { q: string; status: "All" | "running" | "expired"; page: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { rows, page, total, totalPages, stats } = initial;
  const [search, setSearch] = useState(query.q);
  const [statusFilter, setStatusFilter] = useState<"All" | "running" | "expired">(query.status);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContractListItem | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSearch(query.q);
    setStatusFilter(query.status);
  }, [query.q, query.status]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (search === query.q) return;
      pushQuery({ q: search, page: 1 });
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search only
  }, [search]);

  const presetEmployee = useMemo(() => {
    if (!filterEmployeeCode) return null;
    return options.employees.find((row) => row.employeeId === filterEmployeeCode) ?? null;
  }, [filterEmployeeCode, options.employees]);

  const [employeeProfileId, setEmployeeProfileId] = useState(presetEmployee?.id ?? "");
  const [departmentId, setDepartmentId] = useState(presetEmployee?.departmentId ?? "");
  const [scheduleId, setScheduleId] = useState("");
  const [salaryStructureId, setSalaryStructureId] = useState("");
  const [jobTitle, setJobTitle] = useState(presetEmployee?.jobTitle ?? "");
  const [wage, setWage] = useState("50000");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"running" | "expired">("running");
  const [notes, setNotes] = useState("");

  function pushQuery(patch: Partial<{ q: string; status: string; page: number }>) {
    const params = new URLSearchParams();
    const next = {
      q: patch.q ?? search,
      status: patch.status ?? statusFilter,
      page: patch.page ?? query.page,
    };
    if (filterEmployeeCode) params.set("employeeId", filterEmployeeCode);
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.status && next.status !== "All") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function resetForm(next?: ContractListItem | null) {
    if (next) {
      setEditing(next);
      setEmployeeProfileId(next.employeeProfileId);
      setDepartmentId(next.departmentId ?? "");
      setScheduleId(next.scheduleId ?? "");
      setSalaryStructureId(next.salaryStructureId ?? "");
      setJobTitle(next.jobTitle);
      setWage(String(next.wage));
      setStartDate(next.startDate);
      setEndDate(next.endDate ?? "");
      setStatus(next.status);
      setNotes(next.notes ?? "");
      return;
    }
    setEditing(null);
    const emp = presetEmployee;
    setEmployeeProfileId(emp?.id ?? "");
    setDepartmentId(emp?.departmentId ?? "");
    setScheduleId("");
    setSalaryStructureId("");
    setJobTitle(emp?.jobTitle ?? "");
    setWage("50000");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setStatus("running");
    setNotes("");
  }

  function openCreate() {
    resetForm(null);
    setEditorOpen(true);
  }

  function openEdit(row: ContractListItem) {
    resetForm(row);
    setEditorOpen(true);
  }

  function onEmployeeChange(id: string) {
    setEmployeeProfileId(id);
    const emp = options.employees.find((row) => row.id === id);
    if (!emp) return;
    if (!editing) {
      setDepartmentId(emp.departmentId);
      setJobTitle(emp.jobTitle);
    }
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertContractAction({
        id: editing?.id,
        employeeProfileId,
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
        toast.error(result.error);
        return;
      }
      setEditorOpen(false);
      toast.success(editing ? `Updated ${result.data.code}.` : `Created ${result.data.code}.`);
      router.refresh();
    });
  }

  function handleDelete(row: ContractListItem) {
    if (!window.confirm(`Delete contract ${row.code}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteContractAction(row.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${row.code}.`);
      router.refresh();
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-medium">Contracts</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Running and expired employment contracts with wage history.
          </p>
          {filterEmployeeCode ? (
            <p className="text-xs font-semibold text-zinc-500">
              Filtered to employee{" "}
              <Link
                href={`/admin/people/employees/${filterEmployeeCode}`}
                className="text-zinc-900 underline"
              >
                {filterEmployeeCode}
              </Link>
              {" · "}
              <Link href="/admin/people/contracts" className="text-zinc-600 underline">
                Clear filter
              </Link>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all"
        >
          <Plus className="size-4" />
          Add contract
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total contracts", value: String(stats.total) },
          { label: "Running", value: String(stats.running) },
          { label: "Ending ≤45 days", value: String(stats.endingSoon) },
          {
            label: "Monthly wage (running)",
            value: `₹${stats.wageMonthly.toLocaleString("en-IN")}`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="border border-border rounded-xl px-4 py-3 bg-surface hover:bg-surface-hover/40 transition-colors"
          >
            <p className="text-xs font-semibold text-zinc-500">{card.label}</p>
            <p className="text-lg font-semibold text-zinc-950 mt-1 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 size-4 text-zinc-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, employee, department, or position"
            className="w-full h-10 pl-9 pr-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["All", "running", "expired"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setStatusFilter(key);
                pushQuery({ status: key, page: 1 });
              }}
              className={cn(
                "cursor-pointer h-9 px-3 rounded-lg text-xs font-semibold border transition-colors",
                statusFilter === key
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-surface text-zinc-600 border-border hover:bg-surface-hover",
              )}
            >
              {key === "All" ? "All" : key === "running" ? "Running" : "Expired"}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center border border-dashed border-border rounded-xl">
          <FileText className="size-8 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-500">No contracts yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Wage / month</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-surface-hover/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/people/contracts/${row.id}`}
                      className="font-semibold text-zinc-950 hover:underline"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="cursor-pointer text-left"
                    >
                      <p className="font-semibold text-zinc-900">{row.employeeName}</p>
                      <p className="text-xs text-zinc-400">
                        {row.employeeCode} · {row.jobTitle}
                      </p>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{row.departmentName ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.startLabel}</td>
                  <td className="px-4 py-3 text-zinc-600">{row.endLabel}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-900">
                    ₹{row.wage.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        row.status === "running"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200",
                      )}
                    >
                      {row.status === "running" ? "Running" : "Expired"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(row)}
                      className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-error hover:bg-error-soft/50 disabled:opacity-60"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
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
        onPageChange={(next) => pushQuery({ page: next })}
      />

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `Edit ${editing.code}` : "Add contract"}
        description="Only one Running contract may cover the same dates."
        className="max-w-xl"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-3 text-left">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-500">Employee</span>
            <select
              value={employeeProfileId}
              onChange={(e) => onEmployeeChange(e.target.value)}
              required
              className={inputClass}
              disabled={Boolean(editing)}
            >
              <option value="">Select employee</option>
              {options.employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeId})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-500">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong resize-y"
            />
          </label>

          <button
            type="submit"
            disabled={pending || !employeeProfileId}
            className="cursor-pointer mt-1 h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save contract"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
