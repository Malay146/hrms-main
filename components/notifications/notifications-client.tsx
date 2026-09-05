"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Trash2,
  Search,
  ChevronDown,
  Volume2,
  Mail,
  Bell,
  Megaphone,
  CheckCheck,
  Trash,
} from "lucide-react";
import { cn } from "@/utils/cn";
import {
  clearNotificationsAction,
  createAnnouncementAction,
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  saveNotificationPreferencesAction,
  type NotificationItem,
  type NotificationPreferences,
} from "@/lib/actions/notifications";

function iconFor(type: string) {
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
}

export function NotificationsClient({
  title,
  subtitle,
  initialItems,
  initialAnnouncements,
  initialPreferences,
  showRecruitmentEmail,
  canAnnounce,
}: {
  title: string;
  subtitle: string;
  initialItems: NotificationItem[];
  initialAnnouncements: NotificationItem[];
  initialPreferences: NotificationPreferences;
  showRecruitmentEmail: boolean;
  canAnnounce: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
    setAnnouncements(initialAnnouncements);
    setPreferences(initialPreferences);
  }, [initialItems, initialAnnouncements, initialPreferences]);

  const categories = useMemo(() => {
    const names = [...new Set(items.map((row) => row.category))];
    return ["All", ...names.sort()];
  }, [items]);

  const filtered = items.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      row.title.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q);
    const matchesCategory = selectedCategory === "All" || row.category === selectedCategory;
    const matchesStatus =
      selectedStatus === "All" ||
      (selectedStatus === "Read" && row.read) ||
      (selectedStatus === "Unread" && !row.read);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  function patchItem(id: string, next: Partial<NotificationItem>) {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function markRead(id: string, read = true) {
    patchItem(id, { read });
    startTransition(async () => {
      const result = await markNotificationReadAction(id, read);
      if (!result.ok) setMessage(result.error);
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((row) => row.id !== id));
    setAnnouncements((prev) => prev.filter((row) => row.id !== id));
    startTransition(async () => {
      const result = await deleteNotificationAction(id);
      if (!result.ok) {
        setMessage(result.error);
        router.refresh();
      }
    });
  }

  function markAll() {
    setItems((prev) => prev.map((row) => ({ ...row, read: true })));
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) setMessage(result.error);
    });
  }

  function clearAll() {
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    setItems([]);
    setAnnouncements([]);
    startTransition(async () => {
      const result = await clearNotificationsAction();
      if (!result.ok) {
        setMessage(result.error);
        router.refresh();
      }
    });
  }

  function togglePreference(key: keyof NotificationPreferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    startTransition(async () => {
      const result = await saveNotificationPreferencesAction(next);
      if (!result.ok) {
        setMessage(result.error);
        setPreferences(preferences);
        return;
      }
      if (key === "inApp") router.refresh();
    });
  }

  function postAnnouncement() {
    startTransition(async () => {
      const result = await createAnnouncementAction({
        title: announceTitle,
        body: announceBody,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setAnnounceTitle("");
      setAnnounceBody("");
      setMessage(`Posted to ${result.data.count} people.`);
      router.refresh();
    });
  }

  const emailSettings = [
    showRecruitmentEmail ? { key: "emailRecruitment" as const, label: "Job Applications" } : null,
    { key: "emailLeave" as const, label: "Leave & Leave Approvals" },
    { key: "emailPerformance" as const, label: "Performance Submissions" },
    { key: "emailPayroll" as const, label: "Payslip emails" },
  ].filter(Boolean) as { key: keyof NotificationPreferences; label: string }[];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">{title}</h1>
          <p className="text-body-lg text-zinc-500 font-medium">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={markAll}
            disabled={pending}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all"
          >
            <CheckCheck className="size-4 text-zinc-500" />
            Mark All Read
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-error-soft/50 hover:text-error hover:border-error/30 text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all"
          >
            <Trash className="size-4" />
            Clear All
          </button>
        </div>
      </div>

      {message ? <p className="text-sm font-medium text-zinc-600">{message}</p> : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative flex items-center">
              <Search className="absolute left-3 size-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong transition-colors"
              />
            </div>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "All" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
              >
                {["All", "Read", "Unread"].map((st) => (
                  <option key={st} value={st}>
                    {st === "All" ? "All Statuses" : st}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filtered.length === 0 ? (
              <div className="border border-border border-dashed rounded-xl py-12 text-center text-sm font-semibold text-zinc-400">
                No notifications yet.
              </div>
            ) : (
              filtered.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.read) markRead(notif.id, true);
                    if (notif.href) router.push(notif.href);
                  }}
                  className={cn(
                    "border rounded-xl p-4 bg-surface hover:border-zinc-300 transition-all flex gap-4 relative group cursor-pointer",
                    notif.read ? "border-border" : "border-zinc-950/80 bg-zinc-50/10",
                  )}
                >
                  <div className="size-10 rounded-lg bg-zinc-50 border border-border flex items-center justify-center text-xl shrink-0">
                    {iconFor(notif.type)}
                  </div>
                  <div className="flex-1 flex flex-col min-w-0 text-left pr-12">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-950 truncate leading-tight">
                        {notif.title}
                      </h3>
                      {!notif.read && <span className="size-2 rounded-full bg-zinc-950 shrink-0" />}
                    </div>
                    <p className="text-sm font-medium text-zinc-500 mt-1 leading-relaxed">
                      {notif.description}
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs font-semibold text-zinc-400">
                      <span>{notif.date}</span>
                      <span>&bull;</span>
                      <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full text-[10px]">
                        {notif.category}
                      </span>
                    </div>
                  </div>
                  <div className="absolute right-4 top-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(notif.id, !notif.read);
                      }}
                      className="cursor-pointer p-1.5 rounded-lg border border-border bg-surface hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 transition-colors"
                      title={notif.read ? "Mark as unread" : "Mark as read"}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(notif.id);
                      }}
                      className="cursor-pointer p-1.5 rounded-lg border border-border bg-surface hover:bg-error-soft text-zinc-500 hover:text-error hover:border-error/30 transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-md font-semibold text-zinc-950 flex items-center gap-2">
              <Bell className="size-4 text-zinc-400" />
              Notification Settings
            </h3>
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Email Alerts
                </span>
                {emailSettings.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between text-sm font-semibold text-zinc-700 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Mail className="size-3.5 text-zinc-400" />
                      {item.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[item.key])}
                      onChange={() => togglePreference(item.key)}
                      className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-3 border-t border-border">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Device Alerts
                </span>
                {(
                  [
                    { key: "inApp" as const, label: "In-app notifications", icon: Bell },
                    { key: "sounds" as const, label: "Alert Notification Sounds", icon: Volume2 },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between text-sm font-semibold text-zinc-700 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <item.icon className="size-3.5 text-zinc-400" />
                      {item.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[item.key])}
                      onChange={() => togglePreference(item.key)}
                      className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-md font-semibold text-zinc-950 flex items-center gap-2">
              <Megaphone className="size-4 text-zinc-400" />
              Company Announcements
            </h3>
            {canAnnounce ? (
              <form
                className="flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  postAnnouncement();
                }}
              >
                <input
                  value={announceTitle}
                  onChange={(e) => setAnnounceTitle(e.target.value)}
                  placeholder="Title"
                  className="h-10 px-3 border border-border rounded-lg text-sm"
                  required
                />
                <textarea
                  value={announceBody}
                  onChange={(e) => setAnnounceBody(e.target.value)}
                  placeholder="Details for everyone in the company"
                  rows={3}
                  className="px-3 py-2 border border-border rounded-lg text-sm resize-y"
                  required
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="cursor-pointer h-10 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 disabled:opacity-60"
                >
                  {pending ? "Posting…" : "Post announcement"}
                </button>
              </form>
            ) : null}
            <div className="flex flex-col gap-3">
              {announcements.length === 0 ? (
                <p className="text-sm font-medium text-zinc-400">No announcements yet.</p>
              ) : (
                announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="border border-border rounded-lg p-3.5 bg-zinc-50/30 flex flex-col gap-1.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-sm font-semibold text-zinc-900 leading-tight truncate">
                        {ann.title}
                      </span>
                      <span className="text-[11px] text-zinc-400 shrink-0 font-semibold">{ann.time}</span>
                    </div>
                    <p className="text-[12px] text-zinc-500 leading-normal font-semibold">
                      {ann.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
