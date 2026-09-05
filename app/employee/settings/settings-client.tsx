"use client";

import React, { useState, useTransition } from "react";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { toast } from "sonner";
import { changePasswordAction } from "@/lib/actions/auth";
import type { EmployeeListItem, SessionUser } from "@/lib/shared/types";

export function EmployeeSettingsClient({
  profile,
  user,
}: {
  profile: EmployeeListItem | null;
  user: SessionUser | null;
}) {
  const displayName = profile?.name ?? user?.fullName ?? "Employee";
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const detailFields = [
    { label: "Full name", value: displayName },
    { label: "Email", value: profile?.email ?? user?.email ?? "—" },
    { label: "Employee ID", value: profile?.employeeId ?? user?.employeeId ?? "—" },
    { label: "Department", value: profile?.department ?? user?.department ?? "—" },
    { label: "Designation", value: profile?.designation ?? user?.jobTitle ?? "—" },
    { label: "Phone", value: profile?.phone ?? user?.phone ?? "—" },
    { label: "Employment type", value: profile?.type ?? "—" },
    { label: "Status", value: profile?.status ?? user?.status ?? "—" },
    { label: "Joined", value: profile?.joinDate ?? "—" },
  ];

  const handleChangePassword = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    });
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 text-left">
      <div className="flex flex-col">
        <h1 className="type-title">Settings</h1>
        <p className="type-subtitle">
          View your account details and update your password.
        </p>
      </div>

      <div className="border border-border rounded-xl p-6 bg-surface flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <PersonAvatar name={displayName} size={72} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h2 className="text-lg font-bold text-zinc-950 leading-tight">{displayName}</h2>
          <p className="text-sm font-semibold text-zinc-500">
            {profile?.designation ?? user?.jobTitle ?? "Employee"}
            {(profile?.department || user?.department) &&
              ` • ${profile?.department ?? user?.department}`}
          </p>
          <p className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5 mt-1">
            <Mail className="size-3.5 shrink-0" />
            {profile?.email ?? user?.email ?? "—"}
          </p>
        </div>
      </div>

      <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <ShieldCheck className="size-4 text-zinc-400" />
          Account details
        </h3>
        <p className="text-xs font-medium text-zinc-400 -mt-2">
          These details are managed by HR and cannot be edited here.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {detailFields.map((field) => (
            <div key={field.label} className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-zinc-500">{field.label}</span>
              <div className="h-10 px-3 border border-border rounded-lg text-sm font-medium text-zinc-900 bg-zinc-50 flex items-center truncate">
                {field.value || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4 max-w-lg">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <Lock className="size-4 text-zinc-400" />
          Change password
        </h3>
        <form className="flex flex-col gap-4" onSubmit={handleChangePassword}>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters, including a number"
              className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer self-start px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out disabled:opacity-60"
          >
            {pending ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
