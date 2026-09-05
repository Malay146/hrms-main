"use client";

import React, { useState, useTransition } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/utils/cn";
import ShieldCheckIcon from "@/components/icons/shield-check";
import { toast } from "sonner";
import { changePasswordAction } from "@/lib/actions/auth";

export default function EmployeeSettingsPage() {
  const [activeTab, setActiveTab] = useState<"security">("security");
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [pending, startTransition] = useTransition();

  const handleSaveChanges = () => {
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: passwords.current,
        newPassword: passwords.next,
        confirmPassword: passwords.confirm,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    });
  };

  const handleCancelChanges = () => {
    setPasswords({ current: "", next: "", confirm: "" });
    toast.info("Changes discarded");
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col text-left">
          <h1 className="type-title">Account Settings</h1>
          <p className="type-subtitle">
            Manage your personal security settings and password.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancelChanges}
            className="cursor-pointer px-4 py-2 border border-border rounded-md bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleSaveChanges}
            className="cursor-pointer px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2">
        <div className="lg:col-span-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={cn(
              "cursor-pointer flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all border",
              activeTab === "security"
                ? "bg-zinc-900 text-white border-zinc-900"
                : "text-zinc-600 border-transparent hover:bg-zinc-50",
            )}
          >
            <span className="flex items-center gap-3">
              <ShieldCheckIcon className="size-5" />
              Security & Passwords
            </span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="lg:col-span-9 border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 text-left">
          <div>
            <h2 className="text-lg font-bold text-zinc-950">Security Settings</h2>
            <p className="text-sm text-zinc-500 mt-0.5 font-medium">
              Change your password. Other sessions will be signed out.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Lock className="size-4 text-zinc-400" />
              Change Password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  ["current", "Current Password"],
                  ["next", "New Password"],
                  ["confirm", "Confirm Password"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">{label}</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwords[key]}
                    onChange={(e) =>
                      setPasswords((current) => ({ ...current, [key]: e.target.value }))
                    }
                    className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-border-strong font-medium"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
