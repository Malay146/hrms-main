"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FilterX, MoreHorizontal, Plus, Search, Upload } from "lucide-react";
import { cn } from "@/utils/cn";
import TotalEmployeeIcon from "@/components/icons/total-employee";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import InactiveIcon from "@/components/icons/inactive";
import { Toast } from "@/components/ui/toast";
import { createEmployeeAction } from "@/lib/actions/employees";
import type { EmployeeListItem } from "@/lib/types";

export function EmployeesClient({
  initialEmployees,
}: {
  initialEmployees: EmployeeListItem[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const dropdownRef = useRef<HTMLTableCellElement>(null);

  const departments = useMemo(
    () => ["All", ...new Set(employees.map((emp) => emp.department))],
    [employees],
  );

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDept === "All" || emp.department === selectedDept;
    const matchesStatus = selectedStatus === "All" || emp.status === selectedStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.status === "Active").length;
  const onLeaveCount = employees.filter((e) => e.status === "On Leave").length;
  const inactiveCount = employees.filter((e) => e.status === "Inactive").length;

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await createEmployeeAction({
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      department: String(form.get("department") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? ""),
      phone: String(form.get("phone") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setToast({ message: result.error, type: "error" });
      return;
    }
    setShowCreate(false);
    setToast({ message: `Created ${result.data.employeeId}`, type: "success" });
    window.location.reload();
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">Employees</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Manage and view all employees in your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all">
            <Upload className="size-4 text-zinc-500" />
            Import Employees
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all"
          >
            <Plus className="size-4" />
            Add Employee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Employees", value: totalCount, icon: TotalEmployeeIcon, bgStart: "#18181B", bgEnd: "#71717A" },
          { label: "Active Employees", value: activeCount, icon: PresentTodayIcon, bgStart: "#059669", bgEnd: "#34D399" },
          { label: "On Leave", value: onLeaveCount, icon: LeaveTodayIcon, bgStart: "#D97706", bgEnd: "#FBBF24" },
          { label: "Inactive Employees", value: inactiveCount, icon: InactiveIcon, bgStart: "#71717A", bgEnd: "#A1A1AA" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between min-h-[140px]">
              <div className="size-12 rounded-lg flex items-center justify-center text-white" style={{ background: `linear-gradient(to top, ${stat.bgStart}, ${stat.bgEnd})` }}>
                <Icon className="size-[30px]" />
              </div>
              <span className="text-2xl font-bold text-zinc-950 leading-none mt-4">{stat.value}</span>
              <p className="text-sm font-medium text-zinc-500 mt-2">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="border border-border rounded-xl p-4 bg-surface grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="size-4 text-zinc-400 absolute left-3 top-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or ID"
            className="h-10 w-full pl-9 pr-3 border border-border rounded-lg bg-surface text-sm focus:outline-none focus:border-border-strong"
          />
        </div>
        <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="h-10 px-3 border border-border rounded-lg bg-surface text-sm">
          {departments.map((dept) => <option key={dept}>{dept}</option>)}
        </select>
        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="h-10 px-3 border border-border rounded-lg bg-surface text-sm">
          {["All", "Active", "On Leave", "Inactive"].map((status) => <option key={status}>{status}</option>)}
        </select>
        <button
          onClick={() => { setSearch(""); setSelectedDept("All"); setSelectedStatus("All"); }}
          className="cursor-pointer h-10 px-3 border border-dashed border-border rounded-lg bg-zinc-50/50 text-xs font-semibold text-zinc-600 flex items-center justify-center gap-2"
        >
          <FilterX className="size-3.5" />
          Clear
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Employee</th>
              <th className="py-3.5 px-6">Department</th>
              <th className="py-3.5 px-6">Designation</th>
              <th className="py-3.5 px-6">Joined</th>
              <th className="py-3.5 px-6">Status</th>
              <th className="py-3.5 px-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No employees found
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.employeeId} className="hover:bg-zinc-50/50">
                  <td className="py-3.5 px-6">
                    <Link href={`/admin/people/employees/${emp.employeeId}`} className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs flex items-center justify-center">
                        {emp.avatar}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900">{emp.name}</p>
                        <p className="text-xs text-zinc-400">{emp.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3.5 px-6 text-zinc-500">{emp.department}</td>
                  <td className="py-3.5 px-6 text-zinc-700">{emp.designation}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{emp.joinDate}</td>
                  <td className="py-3.5 px-6">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      emp.status === "Active" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                      emp.status === "On Leave" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      emp.status === "Inactive" && "bg-zinc-50 text-zinc-500 border-zinc-200",
                    )}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-right relative" ref={activeMenuId === emp.employeeId ? dropdownRef : null}>
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === emp.employeeId ? null : emp.employeeId)}
                      className="cursor-pointer p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {activeMenuId === emp.employeeId && (
                      <div className="absolute right-6 top-10 w-40 bg-surface border border-border rounded-xl shadow-lg py-1 z-40">
                        <Link href={`/admin/people/employees/${emp.employeeId}`} className="block px-3 py-2 text-xs font-semibold rounded-lg hover:bg-surface-hover">
                          View profile
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="w-full max-w-lg border border-border rounded-2xl p-6 bg-surface flex flex-col gap-4">
            <div>
              <h2 className="text-h3 font-semibold">Add Employee</h2>
              <p className="text-sm text-zinc-500 font-medium">Creates a login and an employee ID like ORG-YYYY-NNN.</p>
            </div>
            <input name="fullName" required placeholder="Full name" className="h-10 px-3 border border-border rounded-lg text-sm" />
            <input name="email" type="email" required placeholder="Work email" className="h-10 px-3 border border-border rounded-lg text-sm" />
            <input name="password" type="password" required placeholder="Temporary password" className="h-10 px-3 border border-border rounded-lg text-sm" />
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
                {pending ? "Saving..." : "Create employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
