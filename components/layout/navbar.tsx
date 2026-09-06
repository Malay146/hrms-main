"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/ui/person-avatar";
import NotificationIcon from "@/components/icons/notification";
import SettingsIcon from "@/components/icons/settings";
import LogoutIcon from "@/components/icons/logout";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useSessionUser } from "@/components/providers/session-context";
import { firstAllowedAdminPath, isStaffRole, ROLE_LABELS } from "@/lib/auth/permissions";
import { AttendanceWidget } from "@/components/layout/attendance-widget";
import { CommandTrigger, useCommandPalette } from "@/components/layout/command-trigger";
import {
  listMyNotifications,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationItem,
} from "@/lib/actions/notifications";
import dynamic from "next/dynamic";

const CommandPalette = dynamic(
  () => import("@/components/layout/command-palette").then((mod) => mod.CommandPalette),
  { ssr: false },
);
const ChevronsUpDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m7 15 5 5 5-5" />
    <path d="m7 9 5-5 5 5" />
  </svg>
);

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    oscillator.stop(ctx.currentTime + 0.18);
    window.setTimeout(() => void ctx.close(), 250);
  } catch {
    // Browser may block audio until a gesture; ignore.
  }
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionUser();
  const isStaff = isStaffRole(user.role);
  const isAdminPortal = pathname.startsWith("/admin");
  const notificationsHref = isAdminPortal ? "/admin/notifications" : "/employee/notifications";
  const settingsHref = isAdminPortal ? "/admin/settings" : "/employee/settings";
  const portalHref = isAdminPortal ? "/employee" : firstAllowedAdminPath(user.role);
  const portalLabel = isAdminPortal ? "My self-service" : "Admin app";

  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const popoverRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const previousUnread = useRef<number | null>(null);

  async function refreshNotifications() {
    const result = await listMyNotifications({ pageSize: 20 });
    if (result.ok) {
      setNotifications(result.data.items.slice(0, 12));
      setUnreadTotal(result.data.unreadCount);
      setSoundsEnabled(result.data.preferences.sounds);
    }
  }

  useEffect(() => {
    void refreshNotifications();
    const timer = window.setInterval(() => {
      void refreshNotifications();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = unreadTotal;
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    if (previousUnread.current !== null && soundsEnabled && unreadCount > previousUnread.current) {
      playNotificationSound();
    }
    previousUnread.current = unreadCount;
  }, [unreadCount, soundsEnabled]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadTotal(0);
    void markAllNotificationsReadAction();
  };

  const handleMarkAsRead = (id: string, href?: string | null) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadTotal((prev) => Math.max(0, prev - 1));
    void markNotificationReadAction(id, true);
    if (href) {
      setIsOpen(false);
      router.push(href);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "leave":
        return "📅";
      case "recruitment":
        return "💼";
      case "performance":
        return "📊";
      case "attendance":
        return "⏰";
      case "payroll":
        return "₹";
      case "announcement":
        return "📣";
      default:
        return "⚙️";
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-[60px] bg-background/80 backdrop-blur-md border-b border-border shrink-0 select-none">
      <div className="flex items-center">
        {!commandOpen ? (
          <CommandTrigger onClick={() => setCommandOpen(true)} />
        ) : null}
        {commandOpen ? (
          <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        ) : null}
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-3">
        <AttendanceWidget />
        {isStaff ? (
          <Link
            href={portalHref}
            className="h-10 px-3 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 flex items-center transition-all"
          >
            {portalLabel}
          </Link>
        ) : null}
        {/* Notification Button & Dropdown */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) void refreshNotifications();
            }}
            className="relative flex items-center justify-center w-10 h-10 bg-surface border border-border rounded-lg text-icon-secondary hover:text-text-primary hover:bg-surface-hover hover:border-border-strong shadow-2xs active:scale-95 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-focus-ring/40 cursor-pointer"
            aria-label="View notifications"
          >
            <NotificationIcon className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-2.5 right-2.5 size-1.5 rounded-full bg-zinc-950 ring-1 ring-white" />
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 top-12 w-[360px] bg-surface border border-border rounded-2xl shadow-lg py-3 z-50 flex flex-col gap-3 text-left animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="px-4 py-1.5 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-950">
                  Notifications
                </h3>
                {hasUnread && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="px-4 flex items-center gap-1.5">
                <button
                  onClick={() => setFilter("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                    filter === "all"
                      ? "bg-zinc-100 text-zinc-900 border border-zinc-200"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50",
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("unread")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                    filter === "unread"
                      ? "bg-zinc-100 text-zinc-900 border border-zinc-200"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50",
                  )}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* List */}
              <div className="flex flex-col max-h-[300px] overflow-y-auto divide-y divide-border">
                {filteredNotifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-400 font-medium">
                    No notifications found
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkAsRead(notif.id, notif.href)}
                      className={cn(
                        "px-4 py-3.5 flex gap-3.5 hover:bg-zinc-50/50 cursor-pointer transition-colors relative",
                        !notif.read && "bg-zinc-50/20",
                      )}
                    >
                      <div className="size-9 rounded-lg bg-zinc-50 border border-border flex items-center justify-center text-lg shrink-0">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 flex flex-col min-w-0 text-left">
                        <div className="flex justify-between items-start gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn(
                                "text-sm font-semibold text-zinc-950 truncate",
                                !notif.read && "font-bold",
                              )}
                            >
                              {notif.title}
                            </span>
                            {!notif.read && (
                              <span className="size-1.5 rounded-full bg-zinc-950 shrink-0" />
                            )}
                          </div>
                          <span className="text-xs text-zinc-400 shrink-0 font-semibold mt-0.5">
                            {notif.time}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed font-medium">
                          {notif.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-4 pt-1.5 border-t border-border flex justify-center">
                <Link
                  href={notificationsHref}
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer w-full text-center py-1"
                >
                  View all notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown Container */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={cn(
              "flex items-center h-10 gap-3 bg-surface border rounded-lg pl-1 pr-3 shadow-2xs hover:border-border-strong hover:bg-surface-hover active:scale-98 transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-focus-ring/40 cursor-pointer",
              isProfileOpen
                ? "border-border-strong bg-surface-hover"
                : "border-border",
            )}
            aria-label="User profile menu"
          >
            <PersonAvatar
              name={user.fullName}
              size={32}
            />
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-body-md font-semibold text-text-primary truncate">
                {user.fullName}
              </span>
              <span className="text-caption text-text-tertiary truncate">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <ChevronsUpDownIcon className="w-5 h-5 text-icon-secondary shrink-0 ml-1" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-12 w-[240px] bg-surface border border-border rounded-2xl shadow-lg py-1.5 z-50 flex flex-col text-left animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Profile Card Header */}
              <div className="px-4 py-3 border-b border-border flex flex-col gap-0.5 select-none">
                <span className="text-sm font-bold text-text-primary">
                  {user.fullName}
                </span>
                <span className="text-xs text-text-tertiary">
                  {user.email}
                </span>
                <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-zinc-100 text-zinc-800 w-fit border border-zinc-200">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>

              {/* Navigation Options */}
              <div className="p-1.5 flex flex-col gap-0.5">
                <Link
                  href={settingsHref}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <SettingsIcon className="size-4 text-icon-secondary" />
                  Account Settings
                </Link>
              </div>

              <div className="border-t border-border" />

              {/* Logout Group */}
              <div className="p-1.5">
                <Link
                  href="/logout"
                  prefetch={false}
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg text-error hover:bg-error-soft/30 transition-all duration-150"
                >
                  <LogoutIcon className="size-4 text-error" />
                  Logout
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
