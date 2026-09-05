"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PersonAvatar } from "@/components/ui/person-avatar";
import SearchIcon from "@/components/icons/navbar/search";
import CommandIcon from "@/components/icons/navbar/command";
import NotificationIcon from "@/components/icons/notification";
import SettingsIcon from "@/components/icons/settings";
import LogoutIcon from "@/components/icons/logout";
import { cn } from "@/utils/cn";
import Link from "next/link";
import { useSessionUser } from "@/components/providers/session-context";
import { firstAllowedAdminPath, isStaffRole, ROLE_LABELS } from "@/lib/auth/permissions";
import { AttendanceWidget } from "@/components/layout/attendance-widget";

// ChevronsUpDown Icon
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

const initialNotifications = [
  {
    id: "notif-1",
    title: "Leave Request Approved",
    description: "Your leave request for August 10th - 15th has been approved.",
    time: "2 mins ago",
    read: false,
    type: "success",
  },
  {
    id: "notif-2",
    title: "New Candidate Application",
    description: "Alice Smith applied for the Frontend Engineer position.",
    time: "1 hr ago",
    read: false,
    type: "info",
  },
  {
    id: "notif-3",
    title: "Performance Review Pending",
    description: "Self-evaluation is due by end of the week.",
    time: "5 hrs ago",
    read: true,
    type: "warning",
  },
  {
    id: "notif-4",
    title: "System Update",
    description: "HRMS will undergo scheduled maintenance at 12:00 AM.",
    time: "1 day ago",
    read: true,
    type: "system",
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const user = useSessionUser();
  const isStaff = isStaffRole(user.role);
  const isAdminPortal = pathname.startsWith("/admin");
  const notificationsHref = isAdminPortal ? "/admin/notifications" : "/employee/notifications";
  const settingsHref = isAdminPortal ? "/admin/settings" : "/employee/settings";
  const portalHref = isAdminPortal ? "/employee" : firstAllowedAdminPath(user.role);
  const portalLabel = isAdminPortal ? "My self-service" : "Admin app";

  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const popoverRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    return true;
  });

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return "📅";
      case "info":
        return "💼";
      case "warning":
        return "📊";
      case "system":
      default:
        return "⚙️";
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-[60px] bg-background/80 backdrop-blur-md border-b border-border shrink-0 select-none">
      {/* Search Input Bar */}
      <div className="flex items-center w-[280px] h-10 bg-surface border border-border rounded-lg px-3 gap-2 shadow-2xs hover:border-border-strong focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-focus-ring/40 transition-all duration-150 cursor-text">
        <SearchIcon className="w-5 h-5 text-icon-secondary shrink-0" />
        <span className="text-body text-text-tertiary flex-1 truncate select-none text-left">
          Find Something
        </span>
        <div className="flex items-center gap-0.5 bg-surface-secondary border border-border rounded px-1.5 py-0.5 text-text-secondary select-none text-[10px] font-medium leading-none shrink-0 shadow-3xs">
          <CommandIcon className="size-4" />
          <span className="text-button">K</span>
        </div>
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
            onClick={() => setIsOpen(!isOpen)}
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
                      onClick={() => handleMarkAsRead(notif.id)}
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
