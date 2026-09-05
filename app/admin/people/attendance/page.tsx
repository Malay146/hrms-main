"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ChevronDown,
  Download,
  Plus,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Clock,
  TrendingUp,
  Activity as ActivityIcon,
  UserMinus,
  FilterX,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/utils/cn";
import { color } from "motion";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import LateIcon from "@/components/icons/late";
import HomeIcon from "@/components/icons/sidebar/home";
import Late from "@/components/icons/late";
import RemoteIcon from "@/components/icons/remote";

// Mock Weekly Chart Data
const weeklyAttendanceData = [
  { day: "Mon", attendance: 235 },
  { day: "Tue", attendance: 231 },
  { day: "Wed", attendance: 240 },
  { day: "Thu", attendance: 238 },
  { day: "Fri", attendance: 228 },
  { day: "Sat", attendance: 120 },
];

// Mock Logs Data
const initialAttendanceLogs = [
  {
    id: "LOG001",
    name: "John Cena",
    email: "john.cena@organization.com",
    avatar: "JC",
    department: "Engineering",
    checkIn: "08:58 AM",
    checkOut: "05:02 PM",
    workingHours: "8.0 hrs",
    status: "On Time",
  },
  {
    id: "LOG002",
    name: "Sarah Mills",
    email: "sarah.mills@organization.com",
    avatar: "SM",
    department: "HR",
    checkIn: "09:00 AM",
    checkOut: "05:00 PM",
    workingHours: "8.0 hrs",
    status: "On Time",
  },
  {
    id: "LOG003",
    name: "Mark Lou",
    email: "mark.lou@organization.com",
    avatar: "ML",
    department: "Sales",
    checkIn: "--:--",
    checkOut: "--:--",
    workingHours: "0.0 hrs",
    status: "Absent",
  },
  {
    id: "LOG004",
    name: "Kimi Nowa",
    email: "kimi.nowa@organization.com",
    avatar: "KN",
    department: "Marketing",
    checkIn: "09:25 AM",
    checkOut: "05:15 PM",
    workingHours: "7.8 hrs",
    status: "Late",
  },
  {
    id: "LOG005",
    name: "William Vance",
    email: "william.vance@organization.com",
    avatar: "WV",
    department: "Finance",
    checkIn: "08:52 AM",
    checkOut: "04:58 PM",
    workingHours: "8.1 hrs",
    status: "On Time",
  },
  {
    id: "LOG006",
    name: "David Smith",
    email: "david.smith@organization.com",
    avatar: "DS",
    department: "Engineering",
    checkIn: "08:55 AM",
    checkOut: "05:05 PM",
    workingHours: "8.1 hrs",
    status: "On Time",
  },
  {
    id: "LOG007",
    name: "Emma Watson",
    email: "emma.watson@organization.com",
    avatar: "EW",
    department: "Marketing",
    checkIn: "09:18 AM",
    checkOut: "01:30 PM",
    workingHours: "4.2 hrs",
    status: "Half Day",
  },
];

// Mock Late Arrivals Feed
const lateArrivals = [
  { name: "Kimi Nowa", time: "09:25 AM", role: "Marketing Specialist" },
  { name: "Emma Watson", time: "09:18 AM", role: "SEO Lead" },
  { name: "Clara Oswald", time: "09:08 AM", role: "Recruiting Coord." },
];

// Mock Activity Stream
const recentLogs = [
  { name: "John Cena", action: "checked out", time: "05:02 PM" },
  { name: "Kimi Nowa", action: "checked out", time: "05:15 PM" },
  { name: "David Smith", action: "checked out", time: "05:05 PM" },
  { name: "Sarah Mills", action: "checked in", time: "09:00 AM" },
];

// Custom Tooltip component for Recharts
const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border px-3 py-1.5 rounded-lg shadow-md text-xs font-semibold">
        <p className="text-zinc-900 font-bold">{label}</p>
        <p className="text-zinc-600 mt-0.5">
          Present:{" "}
          <span className="text-zinc-950 font-bold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function AttendancePage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedDate, setSelectedDate] = useState("2026-07-19");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    setMounted(true);
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Logic
  const filteredLogs = initialAttendanceLogs.filter((log) => {
    const matchesSearch =
      log.name.toLowerCase().includes(search.toLowerCase()) ||
      log.email.toLowerCase().includes(search.toLowerCase()) ||
      log.id.toLowerCase().includes(search.toLowerCase());

    const matchesDept =
      selectedDept === "All" || log.department === selectedDept;
    const matchesStatus =
      selectedStatus === "All" || log.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Checkbox Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredLogs.map((log) => log.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Clear Filters
  const handleClearFilters = () => {
    setSearch("");
    setSelectedDept("All");
    setSelectedStatus("All");
    setSelectedDate("2026-07-19");
    setSelectedIds([]);
  };

  // Status Badge Class Helper
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "On Time":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Late":
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case "Absent":
        return "bg-red-50 text-red-700 border border-red-200/50";
      case "Half Day":
      default:
        return "bg-zinc-50 text-zinc-500 border border-zinc-200";
    }
  };

  const departments = [
    "All",
    "Engineering",
    "HR",
    "Sales",
    "Marketing",
    "Finance",
  ];
  const statuses = ["All", "On Time", "Late", "Absent", "Half Day"];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-h1 font-medium">Attendance</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Monitor employee attendance, working hours, and attendance trends.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-98 transition-all">
            <Download className="size-4 text-zinc-500" />
            Export Report
          </button>
          <button className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 transition-all">
            <Plus className="size-4" />
            Mark Attendance
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Present Today",
            value: "231 / 248",
            color: "text-green-600",
            icon: PresentTodayIcon,
            bgStart: "#059669",
            bgEnd: "#34D399",
            strokeColor: "4, 120, 87",
            shadowColor: "rgba(5, 150, 105, 0.15)",
          },
          {
            label: "Absent Today",
            value: "11 Employees",
            color: "text-red-500",
            icon: LeaveTodayIcon,
            bgStart: "#DC2626",
            bgEnd: "#F87171",
            strokeColor: "185, 28, 28",
            shadowColor: "rgba(220, 38, 38, 0.15)",
          },
          {
            label: "Late Arrivals",
            value: "4 Employees",
            color: "text-amber-500",
            icon: LateIcon,
            bgStart: "#D97706",
            bgEnd: "#FBBF24",
            strokeColor: "180, 83, 9",
            shadowColor: "rgba(217, 119, 6, 0.15)",
          },
          {
            label: "Remote Employees",
            value: "35 Employees",
            icon: RemoteIcon,
            bgStart: "#2563EB",
            bgEnd: "#60A5FA",
            strokeColor: "29, 78, 216",
            shadowColor: "rgba(37, 99, 235, 0.15)",
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between min-h-[140px] hover:shadow-sm hover:border-zinc-300 transition-all duration-200"
            >
              <div className="flex flex-col gap-4">
                <div
                  className="size-12 rounded-lg flex items-center justify-center text-white"
                  style={{
                    outline: `1px solid rgba(${stat.strokeColor}, 0.5)`,
                    outlineOffset: "-1px",
                    background: `linear-gradient(to top, ${stat.bgStart}, ${stat.bgEnd}) padding-box, linear-gradient(to bottom, rgba(${stat.strokeColor}, 0.5) 0%, rgba(${stat.strokeColor}, 0) 59%) border-box`,
                    boxShadow: `0 0 0 1px ${stat.shadowColor}`,
                  }}
                >
                  <Icon className="size-[30px]" />
                </div>
                <span
                  className={cn(
                    "text-2xl font-bold text-zinc-950 leading-none",
                    stat.color,
                  )}
                >
                  {stat.value}
                </span>
              </div>
              <p className="text-sm font-medium text-zinc-500 mt-2">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Left (Chart/Logs), Right (Widgets) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Chart & Table) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Weekly Chart Card */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col">
            <h2 className="text-base font-bold text-zinc-950 mb-4">
              Weekly Attendance Trend
            </h2>
            <div className="h-[200px] w-full flex items-center justify-center">
              {!mounted ? (
                <div className="h-[200px] w-full bg-zinc-50 rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyAttendanceData}
                    margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="attendanceGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#E4E4E7" />
                        <stop offset="100%" stopColor="#18181B" />
                      </linearGradient>
                      <linearGradient
                        id="barStrokeGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#18181B"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="100%"
                          stopColor="#18181B"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="var(--divider)"
                    />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--text-disabled)", fontSize: 11 }}
                      domain={[0, 300]}
                      ticks={[0, 100, 200, 300]}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(0, 0, 0, 0.03)", radius: 6 }}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                    <Bar
                      dataKey="attendance"
                      fill="url(#attendanceGrad)"
                      stroke="url(#barStrokeGrad)"
                      strokeWidth={1}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={50}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Filters Bar & Logs Table Card */}
          <div className="flex flex-col gap-4">
            {/* Filter controls */}
            <div className="border border-border rounded-xl p-4 bg-surface grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative flex items-center">
                <Search className="absolute left-3 size-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 border border-border rounded-lg text-sm text-zinc-900 bg-surface focus:outline-none focus:border-border-strong transition-colors"
                />
              </div>

              {/* Department */}
              <div className="relative">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
                >
                  <option disabled>Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === "All" ? "All Departments" : dept}
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
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status === "All" ? "All Statuses" : status}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
              </div>

              {/* Date & Clear Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
                  />
                </div>
                {(search ||
                  selectedDept !== "All" ||
                  selectedStatus !== "All" ||
                  selectedDate !== "2026-07-19") && (
                  <button
                    onClick={handleClearFilters}
                    className="cursor-pointer h-10 px-3 border border-dashed border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all bg-zinc-50/50"
                  >
                    <FilterX className="size-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Attendance Logs Table */}
            <div className="border border-border rounded-xl bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredLogs.length > 0 &&
                            selectedIds.length === filteredLogs.length
                          }
                          onChange={handleSelectAll}
                          className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-6 font-semibold">Employee</th>
                      <th className="py-3.5 px-6 font-semibold">Department</th>
                      <th className="py-3.5 px-6 font-semibold">Check In</th>
                      <th className="py-3.5 px-6 font-semibold">Check Out</th>
                      <th className="py-3.5 px-6 font-semibold">
                        Working Hours
                      </th>
                      <th className="py-3.5 px-6 font-semibold">Status</th>
                      <th className="py-3.5 px-6 font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-zinc-700 font-medium">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-10 text-center text-zinc-400"
                        >
                          No logs found matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-zinc-50/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(log.id)}
                              onChange={() => handleSelectRow(log.id)}
                              className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-[10px] text-zinc-800 border border-zinc-200 shrink-0">
                                {log.avatar}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-zinc-950 leading-tight truncate">
                                  {log.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                                  {log.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-6 text-zinc-500">
                            {log.department}
                          </td>
                          <td className="py-3.5 px-6">{log.checkIn}</td>
                          <td className="py-3.5 px-6 text-zinc-400">
                            {log.checkOut}
                          </td>
                          <td className="py-3.5 px-6 text-zinc-500">
                            {log.workingHours}
                          </td>
                          <td className="py-3.5 px-6">
                            <span
                              className={cn(
                                "whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
                                getStatusBadgeClass(log.status),
                              )}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td
                            className="py-3.5 px-6 text-right relative"
                            ref={activeMenuId === log.id ? dropdownRef : null}
                          >
                            <button
                              onClick={() =>
                                setActiveMenuId(
                                  activeMenuId === log.id ? null : log.id,
                                )
                              }
                              className="cursor-pointer p-1.5 rounded-lg border border-transparent hover:border-zinc-200 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>

                            {activeMenuId === log.id && (
                              <div className="absolute right-6 top-10 w-40 bg-surface border border-border rounded-lg shadow-lg py-1 z-40 text-left animate-in fade-in duration-100">
                                <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                                  View Log Details
                                </button>
                                <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950">
                                  Adjust Times
                                </button>
                                <hr className="border-border my-1" />
                                <button className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700">
                                  Delete Log
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar Widgets) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Mini Calendar */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <CalendarIcon className="size-4 text-zinc-400" />
              Calendar Overview
            </h3>
            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} className="text-zinc-400 py-1 font-semibold">
                  {day}
                </span>
              ))}
              {Array.from({ length: 31 }, (_, i) => {
                const day = i + 1;
                const isToday = day === 19;
                return (
                  <span
                    key={day}
                    className={cn(
                      "py-1.5 rounded-lg flex items-center justify-center font-bold transition-all",
                      isToday
                        ? "bg-zinc-950 text-white shadow-sm"
                        : "text-zinc-700 hover:bg-zinc-50",
                    )}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Late Arrivals list */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Clock className="size-4 text-zinc-400" />
              Late Arrivals Today
            </h3>
            <div className="flex flex-col divide-y divide-border">
              {lateArrivals.map((late, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-zinc-900 leading-tight truncate">
                      {late.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                      {late.role}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/50">
                    {late.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Working Hours Summary */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <TrendingUp className="size-4 text-zinc-400" />
              Working Hours Summary
            </h3>
            <div className="flex flex-col gap-3 text-xs font-medium text-zinc-500">
              <div className="flex justify-between items-center">
                <span>Average Hours Worked</span>
                <span className="text-zinc-900 font-bold">7.8 hrs / day</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-950 rounded-full"
                  style={{ width: "97.5%" }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-semibold text-zinc-400 mt-1 uppercase">
                <span>Target: 8.0 hrs</span>
                <span className="text-zinc-900 font-bold">97.5% Achieved</span>
              </div>
            </div>
          </div>

          {/* Recent Attendance Activity Stream */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <ActivityIcon className="size-4 text-zinc-400" />
              Recent Activity
            </h3>
            <div className="flex flex-col gap-3">
              {recentLogs.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <div className="size-2 bg-zinc-300 rounded-full mt-1.5 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <p className="text-zinc-800 leading-tight">
                      <span className="font-bold text-zinc-905">
                        {activity.name}
                      </span>{" "}
                      {activity.action}
                    </p>
                    <span className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                      {activity.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
