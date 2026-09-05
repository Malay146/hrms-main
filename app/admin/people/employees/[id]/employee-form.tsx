"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { cn } from "@/utils/cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Toast } from "@/components/ui/toast";
import {
  updateEmployeeAction,
  type EmployeeHubData,
  type EmployeeHubRecord,
} from "@/lib/actions/people/employees";

type Tab = "work" | "private" | "hr";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

export function EmployeeForm({ initial }: { initial: EmployeeHubData }) {
  const [employee, setEmployee] = useState(initial.employee);
  const [tab, setTab] = useState<Tab>("work");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  const [fullName, setFullName] = useState(employee.fullName);
  const [departmentId, setDepartmentId] = useState(employee.departmentId);
  const [managerId, setManagerId] = useState(employee.managerId ?? "");
  const [scheduleId, setScheduleId] = useState(employee.scheduleId ?? "");
  const [jobTitle, setJobTitle] = useState(employee.jobTitle);
  const [companyName, setCompanyName] = useState(employee.companyName ?? "");
  const [workLocation, setWorkLocation] = useState(employee.workLocation ?? "");
  const [employeeType, setEmployeeType] = useState(employee.employeeType);
  const [status, setStatus] = useState(employee.status);
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [personalEmail, setPersonalEmail] = useState(employee.personalEmail ?? "");
  const [address, setAddress] = useState(employee.address ?? "");
  const [bankAccount, setBankAccount] = useState(employee.bankAccount ?? "");
  const [joinDate, setJoinDate] = useState(employee.joinDate ?? "");

  function applySaved(next: EmployeeHubRecord) {
    setEmployee(next);
    setFullName(next.fullName);
    setDepartmentId(next.departmentId);
    setManagerId(next.managerId ?? "");
    setScheduleId(next.scheduleId ?? "");
    setJobTitle(next.jobTitle);
    setCompanyName(next.companyName ?? "");
    setWorkLocation(next.workLocation ?? "");
    setEmployeeType(next.employeeType);
    setStatus(next.status);
    setPhone(next.phone ?? "");
    setPersonalEmail(next.personalEmail ?? "");
    setAddress(next.address ?? "");
    setBankAccount(next.bankAccount ?? "");
    setJoinDate(next.joinDate ?? "");
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateEmployeeAction({
        employeeId: employee.employeeId,
        fullName,
        departmentId,
        managerId: managerId || null,
        scheduleId: scheduleId || null,
        jobTitle,
        companyName: companyName || null,
        workLocation: workLocation || null,
        employeeType,
        status,
        phone: phone || null,
        personalEmail: personalEmail || null,
        address: address || null,
        bankAccount: bankAccount || null,
        joinDate: joinDate || null,
      });
      if (!result.ok) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      applySaved(result.data);
      setToast({ message: "Employee saved.", type: "success" });
    });
  }

  const smartLinks = [
    {
      label: "Contracts",
      count: employee.counts.contracts,
      href: `/admin/people/contracts?employeeId=${employee.employeeId}`,
    },
    {
      label: "Attendance",
      count: employee.counts.attendance,
      href: `/admin/people/attendance?employeeId=${employee.employeeId}`,
    },
    {
      label: "Time Off",
      count: employee.counts.leave,
      href: `/admin/people/leave?employeeId=${employee.employeeId}`,
    },
    {
      label: "Allocations",
      count: employee.counts.allocations,
      href: `/admin/people/leave/allocations?employeeId=${employee.employeeId}`,
    },
  ];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/people/employees"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 font-semibold"
        >
          <ArrowLeft className="size-4" />
          Back to Employees
        </Link>
      </div>

      <div className="border border-border rounded-xl p-6 bg-surface flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <PersonAvatar name={employee.fullName} size={80} />
        <div className="flex-1 flex flex-col gap-2 min-w-0 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <h1 className="text-h1 font-medium">{employee.fullName}</h1>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold border w-fit",
                employee.statusLabel === "Active" &&
                  "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                employee.statusLabel === "On Leave" &&
                  "bg-amber-50 text-amber-700 border-amber-200/50",
                employee.statusLabel === "Inactive" &&
                  "bg-zinc-50 text-zinc-500 border-zinc-200",
              )}
            >
              {employee.statusLabel}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-500">
            {employee.jobTitle} • {employee.departmentName}
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-zinc-400 mt-1">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {employee.email}
            </span>
            {employee.phone ? (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {employee.phone}
              </span>
            ) : null}
            <span>{employee.employeeId}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {smartLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="border border-border rounded-xl px-4 py-3 bg-surface hover:border-border-strong transition-colors"
          >
            <p className="text-xs font-semibold text-zinc-500">{link.label}</p>
            <p className="text-lg font-bold text-zinc-950 mt-1">{link.count}</p>
          </Link>
        ))}
      </div>

      <form onSubmit={handleSave} className="border border-border rounded-xl bg-surface flex flex-col">
        <div className="flex items-center gap-1 border-b border-border px-3 pt-3">
          {(
            [
              ["work", "Work"],
              ["private", "Private"],
              ["hr", "HR settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 -mb-px transition-colors",
                tab === id
                  ? "border-zinc-900 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:text-zinc-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 flex flex-col gap-4">
          {tab === "work" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-500">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Department</span>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                  className={inputClass}
                >
                  {initial.options.departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Manager</span>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {initial.options.managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.employeeId})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Working schedule</span>
                <select
                  value={scheduleId}
                  onChange={(e) => setScheduleId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {initial.options.schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Job title</span>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Company</span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Work location</span>
                <input
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Employee type</span>
                <select
                  value={employeeType}
                  onChange={(e) =>
                    setEmployeeType(e.target.value as typeof employeeType)
                  }
                  className={inputClass}
                >
                  <option value="full_time">Full-time</option>
                  <option value="intern">Intern</option>
                  <option value="contractor">Contractor</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          ) : null}

          {tab === "private" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Personal email</span>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-500">Address</span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong resize-y"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-zinc-500">Bank account</span>
                <input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className={inputClass}
                  placeholder="Needed for payroll warnings"
                />
              </label>
            </div>
          ) : null}

          {tab === "hr" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Join date</span>
                <input
                  type="date"
                  value={joinDate}
                  onChange={(e) => setJoinDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-500">Work email</span>
                <input value={employee.email} disabled className={cn(inputClass, "opacity-70")} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Link
            href="/admin/people/employees"
            className="px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold"
          >
            Cancel
          </Link>
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
