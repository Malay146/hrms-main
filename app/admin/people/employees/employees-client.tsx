"use client";

import React, {
  memo,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ArrowUpDown, FilterX, LayoutGrid, List, Plus, Search, Upload } from "lucide-react";
import { cn } from "@/utils/cn";
import TotalEmployeeIcon from "@/components/icons/total-employee";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import InactiveIcon from "@/components/icons/inactive";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { PersonAvatar } from "@/components/ui/person-avatar";
import {
  createEmployeeAction,
  importEmployeesFromSpreadsheetAction,
  type EmployeeListResult,
  type EmployeeSortKey,
} from "@/lib/actions/people/employees";
import { ASSIGNABLE_ROLES, hasPermission, ROLE_LABELS } from "@/lib/auth/permissions";
import { useSessionUser } from "@/components/providers/session-context";
import type { EmployeeListItem, Role } from "@/lib/shared/types";

type ViewMode = "kanban" | "list";

const KANBAN_COLUMNS = ["Active", "On Leave", "Inactive"] as const;
const CREATE_TOAST_KEY = "hrms-employee-create-toast";

const EmployeeCard = memo(function EmployeeCard({ emp }: { emp: EmployeeListItem }) {
  return (
    <Link
      href={`/admin/people/employees/${emp.employeeId}`}
      className="border border-border rounded-lg p-2.5 bg-surface hover:border-border-strong transition-colors"
    >
      <div className="flex items-start gap-2.5">
        <PersonAvatar name={emp.name} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-zinc-950 truncate">{emp.name}</p>
            {emp.status === "Active" ? (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                Active
              </span>
            ) : null}
          </div>
          <p className="text-[11px] font-medium text-zinc-500 mt-0.5 truncate">{emp.designation}</p>
          <p className="text-[10px] font-semibold text-zinc-400 mt-0.5 truncate">{emp.department}</p>
        </div>
      </div>
    </Link>
  );
});

function statusBadgeClass(status: string) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
  if (status === "On Leave") return "bg-amber-50 text-amber-700 border-amber-200/50";
  return "bg-zinc-50 text-zinc-500 border-zinc-200";
}

export function EmployeesClient({
  initial,
  view,
  query,
}: {
  initial: EmployeeListResult;
  view: ViewMode;
  query: {
    q: string;
    department: string;
    status: string;
    page: number;
    sort: EmployeeSortKey;
    dir: "asc" | "desc";
  };
}) {
  const employees = initial.employees;
  const [searchInput, setSearchInput] = useState(query.q);
  const deferredSearch = useDeferredValue(searchInput);
  const [pendingNav, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    created: number;
    failed: number;
    errors: string[];
    createdRows: { employeeId: string; email: string; temporaryPassword: string }[];
  } | null>(null);
  const [pending, setPending] = useState(false);
  const user = useSessionUser();
  const canCreateUsers = hasPermission(user.role, "createUsers");
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(CREATE_TOAST_KEY);
    if (!raw) return;
    sessionStorage.removeItem(CREATE_TOAST_KEY);
    try {
      const parsed = JSON.parse(raw) as {
        message: string;
        type: "success" | "error";
        description?: string;
      };
      if (!parsed.message) return;
      if (parsed.type === "success") {
        toast.success(parsed.message);
        return;
      }
      toast.error(parsed.message, {
        description: parsed.description,
        duration: 20000,
      });
    } catch {
      // Ignore stale toast payloads.
    }
  }, []);

  useEffect(() => {
    if (deferredSearch === query.q) return;
    const timer = window.setTimeout(() => {
      pushQuery({ q: deferredSearch, page: 1 });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [deferredSearch, query.q]);

  function pushQuery(
    patch: Partial<{
      q: string;
      department: string;
      status: string;
      page: number;
      view: ViewMode;
      sort: EmployeeSortKey;
      dir: "asc" | "desc";
    }>,
  ) {
    const next = new URLSearchParams();
    const q = patch.q ?? query.q;
    const department = patch.department ?? query.department;
    const status = patch.status ?? query.status;
    const page = patch.page ?? query.page;
    const nextView = patch.view ?? view;
    const sort = patch.sort ?? query.sort;
    const dir = patch.dir ?? query.dir;
    if (q) next.set("q", q);
    if (department && department !== "All") next.set("department", department);
    if (status && status !== "All") next.set("status", status);
    if (page > 1) next.set("page", String(page));
    if (nextView === "list") next.set("view", "list");
    if (sort !== "name") next.set("sort", sort);
    if (dir !== "asc") next.set("dir", dir);
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function toggleSort(column: EmployeeSortKey) {
    if (query.sort === column) {
      pushQuery({ dir: query.dir === "asc" ? "desc" : "asc", page: 1, view: "list" });
      return;
    }
    pushQuery({ sort: column, dir: "asc", page: 1, view: "list" });
  }

  function SortHeader({
    label,
    column,
  }: {
    label: string;
    column: EmployeeSortKey;
  }) {
    const active = query.sort === column;
    const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={cn(
          "cursor-pointer inline-flex items-center gap-1.5 uppercase tracking-wider transition-colors",
          active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-800",
        )}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    );
  }

  function filterByKpi(nextStatus: string) {
    pushQuery({
      status: nextStatus,
      page: 1,
      view: "list",
      sort: nextStatus === "All" ? query.sort : "name",
      dir: "asc",
    });
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await createEmployeeAction({
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      role: String(form.get("role") ?? "employee") as Role,
      department: String(form.get("department") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? ""),
      phone: String(form.get("phone") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setShowCreate(false);
    if (result.data.emailSent) {
      sessionStorage.setItem(
        CREATE_TOAST_KEY,
        JSON.stringify({
          message: `Created ${result.data.employeeId}. Login details emailed.`,
          type: "success",
        }),
      );
    } else {
      sessionStorage.setItem(
        CREATE_TOAST_KEY,
        JSON.stringify({
          message: `Created ${result.data.employeeId}. Email failed — temporary password: ${result.data.temporaryPassword ?? "(see server logs)"}`,
          type: "error",
          description: result.data.emailError,
        }),
      );
    }
    window.location.href = pathname;
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    setImportPending(true);
    setImportSummary(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);
      const result = await importEmployeesFromSpreadsheetAction({
        fileName: file.name,
        base64,
      });
      if (!result.ok) {
        toast.error(result.error);
        setImportPending(false);
        return;
      }
      setImportSummary(result.data);
      const importMessage = `Imported ${result.data.created} user(s)${
        result.data.failed ? `, ${result.data.failed} issue(s)` : ""
      }.`;
      if (result.data.created > 0) toast.success(importMessage);
      else toast.error(importMessage);
      if (result.data.created > 0) {
        window.setTimeout(() => {
          window.location.href = pathname;
        }, 1200);
      }
    } catch {
      toast.error("Could not read that file.");
    }
    setImportPending(false);
  }

  const departments = ["All", ...initial.departments];
  const { stats } = initial;

  return (
    <div
      className={cn(
        "w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6",
        pendingNav && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">Employees</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Manage and view all employees in your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-zinc-50">
            <button
              type="button"
              onClick={() => pushQuery({ view: "kanban", page: 1 })}
              className={cn(
                "cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors",
                view === "kanban" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-950",
              )}
            >
              <LayoutGrid className="size-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => pushQuery({ view: "list", page: 1 })}
              className={cn(
                "cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors",
                view === "list" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-950",
              )}
            >
              <List className="size-3.5" />
              List
            </button>
          </div>
          {canCreateUsers ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportSummary(null);
                  setShowImport(true);
                }}
                className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-800 shadow-2xs active:scale-98 transition-all"
              >
                <Upload className="size-4" />
                Import Excel
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all"
              >
                <Plus className="size-4" />
                Add User
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            { label: "Total Employees", value: stats.total, icon: TotalEmployeeIcon, status: "All" },
            { label: "Active Employees", value: stats.active, icon: PresentTodayIcon, status: "Active" },
            { label: "On Leave", value: stats.onLeave, icon: LeaveTodayIcon, status: "On Leave" },
            { label: "Inactive Employees", value: stats.inactive, icon: InactiveIcon, status: "Inactive" },
          ] as const
        ).map((stat) => {
          const Icon = stat.icon;
          const selected = query.status === stat.status;
          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => filterByKpi(stat.status)}
              className={cn(
                "cursor-pointer text-left border rounded-xl p-5 bg-surface flex flex-col justify-between min-h-[140px] transition-all active:scale-[0.99]",
                selected
                  ? "border-zinc-900 ring-1 ring-zinc-900/10 shadow-2xs"
                  : "border-border hover:border-border-strong hover:bg-surface-hover/40",
              )}
            >
              <div
                className="size-12 rounded-lg flex items-center justify-center text-white"
                style={{ background: "linear-gradient(to top, #18181B, #71717A)" }}
              >
                <Icon className="size-[30px]" />
              </div>
              <span className="text-2xl font-bold text-zinc-950 leading-none mt-4">{stat.value}</span>
              <p className="text-sm font-medium text-zinc-500 mt-2">{stat.label}</p>
              <p className="text-[11px] font-semibold text-zinc-400 mt-1">
                {selected ? "Showing in list" : "Click to filter list"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="size-4 text-zinc-400 absolute left-3 top-3" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, or ID"
            className="h-10 w-full pl-9 pr-3 border border-border rounded-lg bg-surface text-sm focus:outline-none focus:border-border-strong"
          />
        </div>
        <select
          value={query.department}
          onChange={(e) => pushQuery({ department: e.target.value, page: 1 })}
          className="h-10 px-3 border border-border rounded-lg bg-surface text-sm"
        >
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept === "All" ? "All departments" : dept}
            </option>
          ))}
        </select>
        <select
          value={query.status}
          onChange={(e) => pushQuery({ status: e.target.value, page: 1 })}
          className="h-10 px-3 border border-border rounded-lg bg-surface text-sm"
        >
          {["All", "Active", "On Leave", "Inactive"].map((status) => (
            <option key={status} value={status}>
              {status === "All" ? "All statuses" : status}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setSearchInput("");
            pushQuery({ q: "", department: "All", status: "All", page: 1, sort: "name", dir: "asc" });
          }}
          className="cursor-pointer h-10 px-3 border border-dashed border-border rounded-lg bg-zinc-50/50 text-xs font-semibold text-zinc-600 flex items-center justify-center gap-2"
        >
          <FilterX className="size-3.5" />
          Clear
        </button>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.map((column) => {
            const cards = employees.filter((emp) => emp.status === column);
            const columnCount =
              column === "Active"
                ? stats.active
                : column === "On Leave"
                  ? stats.onLeave
                  : stats.inactive;
            return (
              <div
                key={column}
                className="border border-border rounded-xl bg-zinc-50 flex flex-col min-h-[180px] max-h-[360px]"
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
                  <h2 className="text-sm font-bold text-zinc-950">{column}</h2>
                  <span className="text-xs font-semibold text-zinc-500">{columnCount}</span>
                </div>
                <div className="flex flex-col gap-2 p-2.5 overflow-y-auto">
                  {cards.length === 0 ? (
                    <p className="text-xs font-medium text-zinc-400 text-center py-6">
                      {column === "Inactive" && stats.removedInactiveCount > 0
                        ? `${stats.removedInactiveCount} removed from the system`
                        : "No employees on this page"}
                    </p>
                  ) : (
                    cards.map((emp) => <EmployeeCard key={emp.employeeId} emp={emp} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold tracking-wider">
                <th className="py-3.5 px-6">
                  <SortHeader label="Employee" column="name" />
                </th>
                <th className="py-3.5 px-6">
                  <SortHeader label="Department" column="department" />
                </th>
                <th className="py-3.5 px-6">
                  <SortHeader label="Designation" column="designation" />
                </th>
                <th className="py-3.5 px-6">
                  <SortHeader label="Joined" column="joined" />
                </th>
                <th className="py-3.5 px-6">
                  <SortHeader label="Status" column="status" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm font-medium text-zinc-400">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr
                    key={emp.employeeId}
                    className="hover:bg-zinc-50/50 cursor-pointer"
                    onClick={() => router.push(`/admin/people/employees/${emp.employeeId}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/admin/people/employees/${emp.employeeId}`);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={emp.name} size={32} />
                        <div>
                          <p className="font-semibold text-zinc-900">{emp.name}</p>
                          <p className="text-xs text-zinc-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-zinc-500">{emp.department}</td>
                    <td className="py-3.5 px-6 text-zinc-700">{emp.designation}</td>
                    <td className="py-3.5 px-6 text-zinc-500">{emp.joinDate}</td>
                    <td className="py-3.5 px-6">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                          statusBadgeClass(emp.status),
                        )}
                      >
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-zinc-500">
          Showing {employees.length} of {initial.total} · page {initial.page}/{initial.totalPages}
          {view === "list"
            ? ` · sorted by ${query.sort} (${query.dir})`
            : null}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={initial.page <= 1 || pendingNav}
            onClick={() => pushQuery({ page: initial.page - 1 })}
            className="cursor-pointer h-9 px-3 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1"
          >
            <ChevronLeft className="size-3.5" />
            Prev
          </button>
          <button
            type="button"
            disabled={initial.page >= initial.totalPages || pendingNav}
            onClick={() => pushQuery({ page: initial.page + 1 })}
            className="cursor-pointer h-9 px-3 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1"
          >
            Next
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg border border-border rounded-2xl p-6 bg-surface flex flex-col gap-4"
          >
            <div>
              <h2 className="text-h3 font-semibold">Add User</h2>
              <p className="text-sm text-zinc-500 font-medium">
                Creates a login. Username and a generated password are emailed to the person.
              </p>
            </div>
            <input name="fullName" required placeholder="Full name" className="h-10 px-3 border border-border rounded-lg text-sm" />
            <input name="email" type="email" required placeholder="Work email" className="h-10 px-3 border border-border rounded-lg text-sm" />
            <select name="role" defaultValue="employee" className="h-10 px-3 border border-border rounded-lg text-sm">
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input name="department" required placeholder="Department" className="h-10 px-3 border border-border rounded-lg text-sm" />
              <input name="jobTitle" required placeholder="Job title" className="h-10 px-3 border border-border rounded-lg text-sm" />
            </div>
            <input name="phone" placeholder="Phone (optional)" className="h-10 px-3 border border-border rounded-lg text-sm" />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="cursor-pointer px-3 py-2 border border-border rounded-lg text-sm font-semibold">
                Cancel
              </button>
              <button disabled={pending} className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold">
                {pending ? "Saving..." : "Create user"}
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal
        open={showImport}
        onClose={() => {
          if (!importPending) setShowImport(false);
        }}
        title="Import users from Excel"
        description="Supports .xlsx, .xls, .csv, .ods and similar spreadsheet files."
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4 text-left">
          <p className="text-xs text-zinc-500 font-medium leading-relaxed">
            First sheet, header row required. Columns: Full Name, Email, Department, Job Title.
            Optional: Role, Phone.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="block w-full text-xs text-zinc-600 file:mr-3 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:text-white file:text-xs file:font-semibold"
            disabled={importPending}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleImportFile(file);
              event.target.value = "";
            }}
          />
          {importPending ? <p className="text-sm font-semibold text-zinc-600">Importing…</p> : null}
          {importSummary ? (
            <div className="border border-border rounded-xl p-3 flex flex-col gap-2 max-h-64 overflow-y-auto">
              <p className="text-sm font-semibold text-zinc-900">
                Created {importSummary.created} · Issues {importSummary.failed}
              </p>
              {importSummary.createdRows.length > 0 ? (
                <div className="text-[11px] text-zinc-600 space-y-1">
                  <p className="font-semibold text-zinc-800">Temporary passwords:</p>
                  {importSummary.createdRows.slice(0, 25).map((row) => (
                    <p key={row.employeeId} className="font-mono">
                      {row.email} · {row.temporaryPassword}
                    </p>
                  ))}
                </div>
              ) : null}
              {importSummary.errors.length > 0 ? (
                <div className="text-[11px] text-red-600 space-y-0.5">
                  {importSummary.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setShowImport(false)}
            disabled={importPending}
            className="cursor-pointer h-10 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 disabled:opacity-60"
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}
