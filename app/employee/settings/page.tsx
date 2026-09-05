"use client";

import React, { useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/utils/cn";
import ShieldCheckIcon from "@/components/icons/shield-check";
import { toast } from "sonner";

// Mock Active Sessions
const initialSessions = [
  {
    id: "sess-1",
    device: "MacBook Pro (Chrome)",
    location: "Mumbai, IN",
    ip: "103.24.120.4",
    current: true,
    type: "desktop",
  },
];

export default function EmployeeSettingsPage() {
  const [activeTab, setActiveTab] = useState<"security">("security");
  const [sessions, setSessions] = useState(initialSessions);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [savedPasswords, setSavedPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const handleRevokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveChanges = () => {
    setSavedPasswords(passwords);
    toast.success("Security settings saved");
  };

  const handleCancelChanges = () => {
    setPasswords(savedPasswords);
    toast.info("Changes discarded");
  };

  const sidebarItems = [
    {
      id: "security" as const,
      label: "Security & Passwords",
      icon: ShieldCheckIcon,
    },
  ];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col text-left">
          <h1 className="type-title">Account Settings</h1>
          <p className="type-subtitle">
            Manage your personal security settings, passwords, and sessions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancelChanges}
            className="cursor-pointer px-4 py-2 border border-border rounded-md bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveChanges}
            className="cursor-pointer px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-2">
        {/* Settings Navigation Menu (Left) */}
        <div className="lg:col-span-3 flex flex-col gap-1.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "cursor-pointer flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all border",
                  isActive
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-3xs"
                    : "text-zinc-600 border-transparent hover:bg-zinc-50 hover:text-zinc-950",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "size-5",
                      isActive ? "text-white" : "text-zinc-400",
                    )}
                  />
                  {item.label}
                </span>
                <ChevronRight
                  className={cn(
                    "size-3.5 opacity-0",
                    isActive && "opacity-100",
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Settings Details Forms (Right) */}
        <div className="lg:col-span-9 border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 text-left">
          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">
                  Security Settings
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5 font-medium">
                  Protect your personal credentials and review active
                  desktop/mobile sessions.
                </p>
              </div>

              {/* Reset Password */}
              <div className="flex flex-col gap-4 mt-2">
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <Lock className="size-4 text-zinc-400" />
                  Change Password
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700">
                      Current Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={passwords.current}
                      onChange={(e) =>
                        setPasswords((current) => ({
                          ...current,
                          current: e.target.value,
                        }))
                      }
                      className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-border-strong font-medium"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={passwords.next}
                      onChange={(e) =>
                        setPasswords((current) => ({
                          ...current,
                          next: e.target.value,
                        }))
                      }
                      className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-border-strong font-medium"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={passwords.confirm}
                      onChange={(e) =>
                        setPasswords((current) => ({
                          ...current,
                          confirm: e.target.value,
                        }))
                      }
                      className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-border-strong font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Active login sessions */}
              <div className="border-t border-border pt-5 flex flex-col gap-4 mt-2">
                <h3 className="text-sm font-bold text-zinc-950">
                  Active Logged-in Sessions
                </h3>
                <div className="flex flex-col gap-3">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between border border-border rounded-xl p-4 bg-zinc-50/25"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-zinc-50 border border-border flex items-center justify-center text-lg shrink-0">
                          {sess.type === "desktop" ? "💻" : "📱"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-900 leading-tight">
                            {sess.device}{" "}
                            {sess.current && (
                              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                Current Session
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                            {sess.location} &bull; IP: {sess.ip}
                          </span>
                        </div>
                      </div>
                      {!sess.current && (
                        <button
                          onClick={() => handleRevokeSession(sess.id)}
                          className="cursor-pointer px-3 py-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent rounded-lg text-xs font-bold transition-all shrink-0"
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
