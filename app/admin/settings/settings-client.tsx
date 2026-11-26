"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock, LogOut, Monitor } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import BuildingIcon from "@/components/icons/building";
import ShieldCheckIcon from "@/components/icons/shield-check";
import { changePasswordAction } from "@/lib/actions/auth";
import {
  listMySessions,
  revokeOtherSessionsAction,
  revokeSessionAction,
  updateOrganizationAction,
  type AccountSession,
  type OrganizationSettings,
} from "@/lib/actions/settings";

type Tab = "organization" | "security";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong font-medium disabled:bg-zinc-50 disabled:text-zinc-500";
const labelClass = "text-xs font-semibold text-zinc-700";
const primaryButton =
  "cursor-pointer px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out disabled:opacity-60 disabled:cursor-not-allowed";
const secondaryButton =
  "cursor-pointer px-4 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out disabled:opacity-60 disabled:cursor-not-allowed";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const dateOnly = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });

export function SettingsClient({
  email,
  organization,
  organizationError,
  sessions: initialSessions,
}: {
  email: string;
  organization: OrganizationSettings | null;
  organizationError: string | null;
  sessions: AccountSession[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("organization");

  const tabs = [
    { id: "organization" as const, label: "Organization", icon: BuildingIcon },
    { id: "security" as const, label: "Security & Sessions", icon: ShieldCheckIcon },
  ];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col">
        <h1 className="type-title">Settings</h1>
        <p className="type-subtitle">
          Manage your organization profile, password, and signed-in devices.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2">
        <div className="lg:col-span-3 flex flex-col gap-1.5">
          {tabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "cursor-pointer flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-semibold transition-all border",
                  isActive
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-3xs"
                    : "text-zinc-600 border-transparent hover:bg-zinc-50 hover:text-zinc-950",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className={cn("size-5", isActive ? "text-white" : "text-zinc-400")} />
                  {item.label}
                </span>
                <ChevronRight className={cn("size-3.5 opacity-0", isActive && "opacity-100")} />
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-9 border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 text-left">
          {activeTab === "organization" &&
            (organization ? (
              <OrganizationTab organization={organization} />
            ) : (
              <p className="text-sm text-zinc-500">{organizationError ?? "Organization not found."}</p>
            ))}
          {activeTab === "security" && <SecurityTab email={email} initialSessions={initialSessions} />}
        </div>
      </div>
    </div>
  );
}

function OrganizationTab({ organization }: { organization: OrganizationSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState({ name: organization.name, email: organization.email });
  const [name, setName] = useState(organization.name);
  const [orgEmail, setOrgEmail] = useState(organization.email);
  const dirty = name !== saved.name || orgEmail !== saved.email;

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateOrganizationAction({ name, email: orgEmail });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved(result.data);
      setName(result.data.name);
      setOrgEmail(result.data.email);
      toast.success("Organization settings saved");
      router.refresh();
    });
  };

  const facts = [
    { label: "Organization code", value: organization.code, hint: "Prefix for employee IDs" },
    { label: "Employees", value: `${organization.activeEmployeeCount} active / ${organization.employeeCount} total` },
    { label: "Departments", value: String(organization.departmentCount) },
    { label: "Created", value: dateOnly.format(new Date(organization.createdAt)) },
    { label: "Payroll currency", value: "INR (₹) Indian Rupee" },
    { label: "Timezone", value: "Asia/Kolkata (IST, GMT+5:30)" },
  ];

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-950">Organization</h2>
        <p className="text-sm text-zinc-500 mt-0.5 font-medium">
          {organization.canEdit
            ? "Company profile used across the app, payslips, and emails."
            : "Only administrators can edit the organization profile."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Organization name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!organization.canEdit || pending}
            className={inputClass}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Organization email</span>
          <input
            type="email"
            value={orgEmail}
            onChange={(event) => setOrgEmail(event.target.value)}
            disabled={!organization.canEdit || pending}
            className={inputClass}
            required
          />
        </label>
      </div>

      {organization.canEdit && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={!dirty || pending} className={primaryButton}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={!dirty || pending}
            onClick={() => {
              setName(saved.name);
              setOrgEmail(saved.email);
            }}
            className={secondaryButton}
          >
            Discard
          </button>
        </div>
      )}

      <div className="border-t border-border pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {facts.map((fact) => (
          <div key={fact.label} className="border border-border rounded-xl p-4 bg-zinc-50/25 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{fact.label}</span>
            <span className="text-sm font-semibold text-zinc-900">{fact.value}</span>
            {fact.hint && <span className="text-[11px] text-zinc-400 font-medium">{fact.hint}</span>}
          </div>
        ))}
      </div>
    </form>
  );
}

function SecurityTab({ email, initialSessions }: { email: string; initialSessions: AccountSession[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sessions, setSessions] = useState(initialSessions);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const refreshSessions = async () => {
    const result = await listMySessions();
    if (result.ok) setSessions(result.data);
  };

  const changePassword = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await changePasswordAction({ currentPassword, newPassword, confirmPassword });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated", { description: "Other devices were signed out." });
      await refreshSessions();
      router.refresh();
    });
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeSessionAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Session signed out");
      await refreshSessions();
    });
  };

  const revokeOthers = () => {
    startTransition(async () => {
      const result = await revokeOtherSessionsAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.revoked === 0
          ? "No other sessions to sign out"
          : `Signed out ${result.data.revoked} other session${result.data.revoked === 1 ? "" : "s"}`,
      );
      await refreshSessions();
    });
  };

  const others = sessions.filter((session) => !session.current).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-950">Security & Sessions</h2>
        <p className="text-sm text-zinc-500 mt-0.5 font-medium">Signed in as {email}.</p>
      </div>

      <form onSubmit={changePassword} className="flex flex-col gap-4">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <Lock className="size-4 text-zinc-400" />
          Change password
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={inputClass}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={inputClass}
              required
              minLength={8}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
              required
            />
          </label>
        </div>
        <p className="text-xs text-zinc-400 font-medium">
          At least 8 characters with one number. Changing it signs out your other devices.
        </p>
        <div>
          <button type="submit" disabled={pending} className={primaryButton}>
            Update password
          </button>
        </div>
      </form>

      <div className="border-t border-border pt-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Signed-in sessions</h3>
            <p className="text-xs text-zinc-400 font-medium mt-0.5">
              A signed-out device loses access within 5 minutes.
            </p>
          </div>
          <button type="button" onClick={revokeOthers} disabled={pending || others === 0} className={secondaryButton}>
            Sign out other sessions
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between border border-border rounded-xl p-4 bg-zinc-50/25"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-zinc-50 border border-border flex items-center justify-center shrink-0">
                  <Monitor className="size-4 text-zinc-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-900 leading-tight">
                    {session.device}
                    {session.current && (
                      <span className="ml-1.5 px-2 py-0.5 rounded-full text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                        This device
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                    {session.ipAddress ? `IP ${session.ipAddress} • ` : ""}
                    Signed in {dateTime.format(new Date(session.createdAt))} • Last active{" "}
                    {dateTime.format(new Date(session.lastActiveAt))}
                  </span>
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => revoke(session.id)}
                  disabled={pending}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg text-xs font-bold transition-all shrink-0 disabled:opacity-60"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              )}
            </div>
          ))}
          {sessions.length === 0 && <p className="text-sm text-zinc-500">No active sessions.</p>}
        </div>
      </div>
    </div>
  );
}
