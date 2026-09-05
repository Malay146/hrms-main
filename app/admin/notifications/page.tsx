"use client";

import React, { useState } from "react";
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
  Trash
} from "lucide-react";
import { cn } from "@/utils/cn";

// Mock Detailed Notifications Data
const initialNotifications = [
  {
    id: "notif-1",
    title: "Leave Request Approved",
    description: "Your leave request for August 10th - 15th has been approved by Bruce Banner.",
    time: "2 mins ago",
    date: "19 Jul 2026, 10:22 AM",
    read: false,
    type: "leave",
    category: "Leave"
  },
  {
    id: "notif-2",
    title: "New Candidate Application",
    description: "Alice Smith applied for the Frontend Engineer role in Engineering division.",
    time: "1 hr ago",
    date: "19 Jul 2026, 09:15 AM",
    read: false,
    type: "recruitment",
    category: "Recruitment"
  },
  {
    id: "notif-3",
    title: "Performance Review Pending",
    description: "Your annual self-evaluation review is due by the end of the current cycle (Friday).",
    time: "5 hrs ago",
    date: "19 Jul 2026, 05:00 AM",
    read: true,
    type: "performance",
    category: "Performance"
  },
  {
    id: "notif-4",
    title: "System Update Complete",
    description: "HRMS application successfully upgraded to version v1.2.4. All systems operational.",
    time: "1 day ago",
    date: "18 Jul 2026, 11:30 PM",
    read: true,
    type: "system",
    category: "System"
  },
  {
    id: "notif-5",
    title: "Attendance Check-In Missed",
    description: "No clock-in record found for Friday, 17th July. Please submit an adjustment form.",
    time: "2 days ago",
    date: "17 Jul 2026, 10:00 AM",
    read: true,
    type: "attendance",
    category: "Attendance"
  }
];

// Mock Global Corporate Announcements
const announcements = [
  {
    id: "ann-1",
    title: "Q3 All-Hands Town Hall",
    description: "Join us on Thursday at 3:00 PM for company updates and team progress showcases.",
    date: "23 Jul 2026"
  },
  {
    id: "ann-2",
    title: "Open Benefits Enrollment",
    description: "Health insurance benefits selection is now active. Please review details by Aug 5th.",
    date: "15 Jul 2026"
  }
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  // Notification Settings States
  const [settings, setSettings] = useState({
    emailRecruitment: true,
    emailLeave: true,
    emailPerformance: false,
    pushNotif: true,
    sounds: false
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Actions
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleToggleRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  // Filter Logic
  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = 
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === "All" || n.category === selectedCategory;
    
    const matchesStatus = 
      selectedStatus === "All" || 
      (selectedStatus === "Read" && n.read) || 
      (selectedStatus === "Unread" && !n.read);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Get icon for notification categories
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
      case "system":
      default:
        return "⚙️";
    }
  };

  const categories = ["All", "Recruitment", "Leave", "Attendance", "Performance", "System"];
  const statuses = ["All", "Read", "Unread"];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">Notifications</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            View, filter, and manage all your notifications and announcements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleMarkAllRead}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all"
          >
            <CheckCheck className="size-4 text-zinc-500" />
            Mark All Read
          </button>
          <button 
            onClick={handleClearAll}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all"
          >
            <Trash className="size-4 text-zinc-500 hover:text-red-600" />
            Clear All
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Notification stream & filters */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          
          {/* Filters controls */}
          <div className="border border-border rounded-xl p-4 bg-surface grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
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

            {/* Category */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
              >
                <option disabled>Category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "All" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
            </div>

            {/* Status */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
              >
                <option disabled>Status</option>
                {statuses.map((st) => (
                  <option key={st} value={st}>
                    {st === "All" ? "All Statuses" : st}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {/* Notifications Feed */}
          <div className="flex flex-col gap-3">
            {filteredNotifications.length === 0 ? (
              <div className="border border-border border-dashed rounded-xl py-12 text-center text-sm font-semibold text-zinc-400">
                No notifications found.
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div 
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id)}
                  className={cn(
                    "border rounded-xl p-4 bg-surface hover:border-zinc-300 hover:shadow-2xs transition-all flex gap-4 relative group cursor-pointer",
                    notif.read ? "border-border" : "border-zinc-950/80 bg-zinc-50/10 shadow-3xs"
                  )}
                >
                  {/* Category icon */}
                  <div className="size-10 rounded-full bg-zinc-50 border border-border flex items-center justify-center text-xl shrink-0">
                    {getIcon(notif.type)}
                  </div>

                  {/* Body content */}
                  <div className="flex-1 flex flex-col min-w-0 text-left pr-12">
                    <div className="flex items-center gap-2">
                      <h3 className={cn("text-base font-semibold text-zinc-950 truncate leading-tight", !notif.read && "font-semibold")}>
                        {notif.title}
                      </h3>
                      {!notif.read && (
                        <span className="size-2 rounded-full bg-zinc-950 shrink-0" />
                      )}
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

                  {/* Actions Area */}
                  <div className="absolute right-4 top-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleRead(notif.id);
                      }}
                      className="cursor-pointer p-1.5 rounded-lg border border-border bg-surface hover:bg-zinc-50 text-zinc-500 hover:text-zinc-950 transition-colors shadow-3xs"
                      title={notif.read ? "Mark as unread" : "Mark as read"}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notif.id);
                      }}
                      className="cursor-pointer p-1.5 rounded-lg border border-border bg-surface hover:bg-red-50 text-zinc-500 hover:text-red-700 hover:border-red-200 transition-colors shadow-3xs"
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

        {/* Right Column: Settings & Announcements */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Notification Settings panel */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-md font-semibold text-zinc-950 flex items-center gap-2">
              <Bell className="size-4 text-zinc-400" />
              Notification Settings
            </h3>
            
            {/* Setting options list */}
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Email Alerts</span>
                {[
                  { key: "emailRecruitment", label: "Job Applications" },
                  { key: "emailLeave", label: "Leave & Leave Approvals" },
                  { key: "emailPerformance", label: "Performance Submissions" },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between text-sm font-semibold text-zinc-700 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Mail className="size-3.5 text-zinc-400" />
                      {item.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof typeof settings]}
                      onChange={() => toggleSetting(item.key as keyof typeof settings)}
                      className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-border">
                <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Device Alerts</span>
                {[
                  { key: "pushNotif", label: "Push Notifications", icon: Bell },
                  { key: "sounds", label: "Alert Notification Sounds", icon: Volume2 },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between text-sm font-semibold text-zinc-700 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <item.icon className="size-3.5 text-zinc-400" />
                      {item.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={settings[item.key as keyof typeof settings]}
                      onChange={() => toggleSetting(item.key as keyof typeof settings)}
                      className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Announcements panel */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-md font-semibold text-zinc-950 flex items-center gap-2">
              <Megaphone className="size-4 text-zinc-400" />
              Company Announcements
            </h3>
            <div className="flex flex-col gap-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="border border-border rounded-lg p-3.5 bg-zinc-50/30 flex flex-col gap-1.5 text-left">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900 leading-tight truncate">{ann.title}</span>
                    <span className="text-[11px] text-zinc-400 shrink-0 font-semibold">{ann.date}</span>
                  </div>
                  <p className="text-[12px] text-zinc-500 leading-normal font-semibold">
                    {ann.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
