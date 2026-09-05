"use client";

import React, { useState } from "react";
import {
  Share2,
  ChevronRight,
  Upload,
  Plus,
  Lock,
  Download,
  Trash2,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/utils/cn";
import BuildingIcon from "@/components/icons/building";
import ShieldCheckIcon from "@/components/icons/shield-check";
import CreditCardIcon from "@/components/icons/credit-card";
import VisaIcon from "@/components/icons/visa";

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
  {
    id: "sess-2",
    device: "iPhone 15 Pro Max (Safari)",
    location: "Delhi, IN",
    ip: "223.18.232.11",
    current: false,
    type: "mobile",
  },
];

// Mock Invoices
const invoices = [
  {
    id: "INV-2026-003",
    date: "15 Jul 2026",
    amount: "$499.00",
    status: "Paid",
  },
  {
    id: "INV-2026-002",
    date: "15 Jun 2026",
    amount: "$499.00",
    status: "Paid",
  },
  {
    id: "INV-2026-001",
    date: "15 May 2026",
    amount: "$499.00",
    status: "Paid",
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "general" | "security" | "billing"
  >("general");
  const [orgName, setOrgName] = useState("William Joseph Corp");
  const [orgSubdomain, setOrgSubdomain] = useState("williamjoseph");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("GMT+5:30");

  // Security States
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30m");
  const [sessions, setSessions] = useState(initialSessions);

  // Billing States
  const [paymentCards, setPaymentCards] = useState([
    {
      id: "card-1",
      brand: "Visa",
      last4: "4242",
      exp: "12/28",
      isDefault: true,
    },
  ]);

  const handleRevokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const sidebarItems = [
    { id: "general" as const, label: "General Settings", icon: BuildingIcon },
    {
      id: "security" as const,
      label: "Security & Access",
      icon: ShieldCheckIcon,
    },
    {
      id: "billing" as const,
      label: "Billing & Subscription",
      icon: CreditCardIcon,
    },
  ];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">Settings</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Manage your organization configurations, security settings, and
            profile details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="cursor-pointer px-4 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all">
            Cancel
          </button>
          <button className="cursor-pointer px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all">
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
                  "cursor-pointer flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-semibold transition-all border",
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
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">
                  General Settings
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5 font-medium">
                  Basic configurations for your company profile and workspaces.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-zinc-700">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-border-strong font-medium"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-zinc-700">
                    Workspace Subdomain
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={orgSubdomain}
                      onChange={(e) => setOrgSubdomain(e.target.value)}
                      className="w-full h-10 pl-3 pr-24 border border-border rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-border-strong font-medium"
                    />
                    <span className="absolute right-3 text-xs font-semibold text-zinc-400">
                      .hrms.com
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-zinc-700">
                    Primary Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong font-medium cursor-pointer"
                  >
                    <option value="USD">USD ($) United States Dollar</option>
                    <option value="EUR">EUR (€) Euro</option>
                    <option value="INR">INR (₹) Indian Rupee</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-zinc-700">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong font-medium cursor-pointer"
                  >
                    <option value="GMT+5:30">
                      GMT+5:30 (India Standard Time)
                    </option>
                    <option value="GMT-8:00">
                      GMT-8:00 (Pacific Standard Time)
                    </option>
                    <option value="GMT+0:00">
                      GMT+0:00 (Greenwich Mean Time)
                    </option>
                  </select>
                </div>
              </div>

              {/* Logo Upload */}
              <div className="flex flex-col gap-2.5 mt-2">
                <span className="text-xs font-semibold text-zinc-700">
                  Organization Logo
                </span>
                <div className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 bg-zinc-50/20">
                  <Upload className="size-6 text-zinc-400" />
                  <p className="text-xs font-semibold text-zinc-500">
                    Drag logo image here, or{" "}
                    <span className="text-zinc-950 font-bold hover:underline cursor-pointer">
                      browse files
                    </span>
                  </p>
                  <span className="text-[10px] text-zinc-400 font-semibold">
                    Recommended size: 256x256px. PNG, JPG max 2MB.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">
                  Security & Access Control
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5 font-medium">
                  Protect your admin accounts, active sessions, and multi-factor
                  requirements.
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
                      className="h-10 px-3 border border-border rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-border-strong font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 2FA Toggle Switch */}
              <div className="border-t border-border pt-5 flex items-center justify-between mt-2">
                <div className="flex flex-col max-w-[80%]">
                  <span className="text-sm font-bold text-zinc-950">
                    Require Two-Factor Authentication (2FA)
                  </span>
                  <p className="text-xs text-zinc-500 mt-1 font-medium leading-relaxed">
                    Mandates that all organization administrators use a
                    secondary code prompt (via authenticator app) to access
                    settings and payroll details.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={() => setTwoFactor(!twoFactor)}
                  className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer scale-120"
                />
              </div>

              {/* Session Timeout */}
              <div className="border-t border-border pt-5 flex flex-col gap-2 mt-2">
                <label className="text-xs font-semibold text-zinc-700">
                  Inactive Session Timeout
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="w-48 h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong font-medium cursor-pointer"
                  >
                    <option value="15m">15 Minutes</option>
                    <option value="30m">30 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="4h">4 Hours</option>
                  </select>
                  <span className="text-xs text-zinc-400 font-medium">
                    Auto-signout administrators after inactivity.
                  </span>
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
                        <div className="size-9 rounded-full bg-zinc-50 border border-border flex items-center justify-center text-lg shrink-0">
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

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">
                  Billing & Subscription
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5 font-medium">
                  Review your current plan details, payment credentials, and
                  download billing invoices.
                </p>
              </div>

              {/* Plan Card */}
              <div className="border border-border rounded-xl p-5 bg-zinc-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 select-none">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Active Plan
                  </span>
                  <span className="text-lg font-bold text-zinc-950 mt-1">
                    Enterprise Subscription (Annual)
                  </span>
                  <p className="text-xs text-zinc-400 font-semibold mt-1">
                    Renews automatically on July 15th, 2027. Paid via credit
                    card.
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end shrink-0">
                  <span className="text-2xl font-black text-zinc-950">
                    $499.00
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">
                    per month
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="border-t border-border pt-5 flex flex-col gap-4 mt-2 text-left">
                <h3 className="text-sm font-bold text-zinc-950">
                  Registered Payment Cards
                </h3>
                {paymentCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between border border-border rounded-xl p-4 bg-surface select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 flex items-center justify-center shrink-0 overflow-hidden">
                        {card.brand.toLowerCase() === "visa" ? (
                          <VisaIcon className="w-full h-full" />
                        ) : (
                          <span className="font-bold text-[10px] text-zinc-800">
                            {card.brand}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-900 leading-tight">
                          •••• •••• •••• {card.last4}{" "}
                          {card.isDefault && (
                            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[9px] bg-zinc-100 text-zinc-700 border border-zinc-200">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                          Expires: {card.exp}
                        </span>
                      </div>
                    </div>
                    <button className="cursor-pointer px-3 py-1.5 border border-border bg-surface hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-lg shadow-3xs active:scale-98 transition-all shrink-0">
                      Edit Card
                    </button>
                  </div>
                ))}
              </div>

              {/* Invoice History */}
              <div className="border-t border-border pt-5 flex flex-col gap-4 mt-2">
                <h3 className="text-sm font-bold text-zinc-950">
                  Billing Invoice Logs
                </h3>
                <div className="border border-border rounded-xl overflow-hidden bg-surface">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-50/80 border-b border-border font-bold text-zinc-400 uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Invoice ID</th>
                        <th className="py-3 px-4">Billing Date</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-zinc-700 font-semibold">
                      {invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="hover:bg-zinc-50/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-zinc-950">{inv.id}</td>
                          <td className="py-3 px-4 text-zinc-400">
                            {inv.date}
                          </td>
                          <td className="py-3 px-4">{inv.amount}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              <CheckCircle className="size-2.5" />
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button className="cursor-pointer p-1.5 border border-border bg-surface hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 rounded-lg shadow-3xs transition-colors">
                              <Download className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
