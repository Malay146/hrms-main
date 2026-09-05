"use client";

import React, { useState, useTransition } from "react";
import { Mail, Phone, Calendar as CalendarIcon, ShieldCheck } from "lucide-react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import { updateMyProfileAction } from "@/lib/actions/profile";
import type { EmployeeListItem } from "@/lib/types";
import type { SessionUser } from "@/lib/types";

export function EmployeeProfileClient({
  profile,
  user,
}: {
  profile: EmployeeListItem | null;
  user: SessionUser | null;
}) {
  const displayName = profile?.name ?? user?.fullName ?? "Employee";
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateMyProfileAction({ phone });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setIsEditOpen(false);
      toast.success("Profile updated");
      window.location.reload();
    });
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 text-left">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="type-title">My Profile</h1>
          <p className="type-subtitle">
            View your registered personal details and employment files.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPhone(profile?.phone ?? "");
            setIsEditOpen(true);
          }}
          className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white"
        >
          Edit Profile
        </button>
      </div>

      <div className="border border-border rounded-xl p-6 bg-surface flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <PersonAvatar name={displayName} size={80} />
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-950 leading-tight">{displayName}</h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full text-[10px] font-bold self-start">
              {profile?.status ?? "Active"}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-500">
            {profile?.designation ?? user?.jobTitle} • {profile?.department ?? user?.department}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-semibold text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {profile?.email ?? user?.email}
            </span>
            {(profile?.phone || phone) && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {profile?.phone ?? phone}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              Joined {profile?.joinDate}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <ShieldCheck className="size-4 text-zinc-400" />
          Employment Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-zinc-500">
          <div className="flex flex-col gap-1">
            <span>Employee ID</span>
            <span className="text-zinc-900 font-bold text-sm">
              {profile?.employeeId ?? user?.employeeId ?? "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span>Department</span>
            <span className="text-zinc-900 font-bold text-sm">{profile?.department ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span>Employment Type</span>
            <span className="text-zinc-900 font-bold text-sm">{profile?.type ?? "Full-time"}</span>
          </div>
        </div>
      </div>

      <Modal open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Profile" description="Update contact details">
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
