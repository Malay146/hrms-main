"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ChevronDown,
  Download,
  Plus,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Check,
  X,
  TrendingUp,
  Activity as ActivityIcon,
  UserMinus,
  FilterX,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "@/utils/cn";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";

// Mock Monthly Area Chart Data
const monthlyLeaveData = [
  { month: "Jan", requests: 12 },
  { month: "Feb", requests: 8 },
  { month: "Mar", requests: 15 },
  { month: "Apr", requests: 10 },
  { month: "May", requests: 14 },
  { month: "Jun", requests: 22 },
  { month: "Jul", requests: 18 },
];

// Mock Leave Requests Data
const initialLeaveRequests = [
  {
    id: "REQ001",
    name: "John Cena",
    email: "john.cena@organization.com",
    avatar: "JC",
    department: "Engineering",
    leaveType: "Annual Leave",
    duration: "5 Days",
    from: "10 Aug 2026",
    to: "15 Aug 2026",
    status: "Pending",
  },
  {
    id: "REQ002",
    name: "Sarah Mills",
    email: "sarah.mills@organization.com",
    avatar: "SM",
    department: "HR",
    leaveType: "Sick Leave",
    duration: "2 Days",
    from: "12 Jul 2026",
    to: "14 Jul 2026",
    status: "Approved",
  },
  {
    id: "REQ003",
    name: "Mark Lou",
    email: "mark.lou@organization.com",
    avatar: "ML",
    department: "Sales",
    leaveType: "Casual Leave",
    duration: "3 Days",
    from: "20 Jul 2026",
    to: "23 Jul 2026",
    status: "Pending",
  },
  {
    id: "REQ004",
    name: "Kimi Nowa",
    email: "kimi.nowa@organization.com",
    avatar: "KN",
    department: "Marketing",
    leaveType: "Annual Leave",
    duration: "1 Day",
    from: "28 Jul 2026",
    to: "28 Jul 2026",
    status: "Approved",
  },
  {
    id: "REQ005",
    name: "Clara Oswald",
    email: "clara.oswald@organization.com",
    avatar: "CO",
    department: "HR",
    leaveType: "Casual Leave",
    duration: "2 Days",
    from: "14 Jul 2026",
    to: "16 Jul 2026",
    status: "Approved",
  },
  {
    id: "REQ006",
    name: "Emma Watson",
    email: "emma.watson@organization.com",
    avatar: "EW",
    department: "Marketing",
    leaveType: "Sick Leave",
    duration: "1 Day",
    from: "18 Jun 2026",
    to: "18 Jun 2026",
    status: "Rejected",
  },
];

// Mock Leave Balances
const leaveBalances = [
  {
    type: "Annual Leave",
    balance: "15 / 20 Days",
    percent: 75,
    color: "bg-zinc-950",
  },
  {
    type: "Sick Leave",
    balance: "8 / 10 Days",
    percent: 80,
    color: "bg-zinc-600",
  },
  {
    type: "Casual Leave",
    balance: "6 / 12 Days",
    percent: 50,
    color: "bg-zinc-400",
  },
];

// Mock Active Leave Avatars
const activeLeavesToday = [
  { avatar: "SM", name: "Sarah Mills" },
  { avatar: "CO", name: "Clara Oswald" },
  { avatar: "ML", name: "Mark Lou" },
];

// Mock Recent activity feed
const recentLeaveActivities = [
  {
    desc: "Sarah Mills - Sick Leave request approved",
    user: "Bruce Banner",
    time: "10 min ago",
  },
  {
    desc: "John Cena submitted Annual Leave request",
    user: "John Cena",
    time: "2 hrs ago",
  },
  {
    desc: "Emma Watson - Sick Leave request rejected",
    user: "Bruce Banner",
    time: "1 day ago",
  },
];

// Custom Tooltip component for Recharts
const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border px-3 py-1.5 rounded-lg shadow-md text-xs font-semibold">
        <p className="text-zinc-900 font-bold">{label}</p>
        <p className="text-zinc-600 mt-0.5">
          Requests:{" "}
          <span className="text-zinc-950 font-bold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function LeaveManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState(initialLeaveRequests);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<(typeof initialLeaveRequests)[0] | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [draftRequest, setDraftRequest] = useState({
    name: "",
    email: "",
    department: "Engineering",
    leaveType: "Annual Leave",
    duration: "1 Day",
    from: "",
    to: "",
  });

  const dropdownRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    setMounted(true);
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
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
  const filteredRequests = leaveRequests.filter((req) => {
    const matchesSearch =
      req.name.toLowerCase().includes(search.toLowerCase()) ||
      req.email.toLowerCase().includes(search.toLowerCase()) ||
      req.id.toLowerCase().includes(search.toLowerCase());

    const matchesDept =
      selectedDept === "All" || req.department === selectedDept;
    const matchesType =
      selectedType === "All" || req.leaveType === selectedType;
    const matchesStatus =
      selectedStatus === "All" || req.status === selectedStatus;

    return matchesSearch && matchesDept && matchesType && matchesStatus;
  });

  // Checkbox Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredRequests.map((req) => req.id));
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
    setSelectedType("All");
    setSelectedStatus("All");
    setSelectedIds([]);
  };

  // Status Badge Class Helper
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
      case "Pending":
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      case "Rejected":
      default:
        return "bg-red-50 text-red-700 border border-red-200/50";
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
  const leaveTypes = ["All", "Annual Leave", "Sick Leave", "Casual Leave"];
  const statuses = ["All", "Approved", "Pending", "Rejected"];

  const pendingCount = leaveRequests.filter((r) => r.status === "Pending").length;
  const approvedCount = leaveRequests.filter((r) => r.status === "Approved").length;
  const onLeaveToday = activeLeavesToday.length;

  const updateRequestStatus = (id: string, status: "Approved" | "Rejected") => {
    setLeaveRequests((current) =>
      current.map((req) => (req.id === id ? { ...req, status } : req)),
    );
    setSelectedRequest((current) =>
      current?.id === id ? { ...current, status } : current,
    );
    toast.success(status === "Approved" ? "Leave approved" : "Leave rejected");
    setActiveMenuId(null);
  };

  const handleCreateRequest = () => {
    if (!draftRequest.name.trim() || !draftRequest.from || !draftRequest.to) {
      toast.error("Name and dates are required");
      return;
    }
    const id = `REQ${String(leaveRequests.length + 1).padStart(3, "0")}`;
    setLeaveRequests((current) => [
      {
        id,
        name: draftRequest.name.trim(),
        email: draftRequest.email.trim() || "employee@organization.com",
        avatar: draftRequest.name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        department: draftRequest.department,
        leaveType: draftRequest.leaveType,
        duration: draftRequest.duration,
        from: draftRequest.from,
        to: draftRequest.to,
        status: "Pending",
      },
      ...current,
    ]);
    setDraftRequest({
      name: "",
      email: "",
      department: "Engineering",
      leaveType: "Annual Leave",
      duration: "1 Day",
      from: "",
      to: "",
    });
    setIsNewOpen(false);
    toast.success("Leave request submitted");
  };

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="type-title">Leave Management</h1>
          <p className="type-subtitle">
            Manage employee leave requests, balances, and approvals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              toast("Export started", {
                description: "Leave report will download shortly.",
              })
            }
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color,border-color] duration-150 ease-out"
          >
            <Download className="size-4 text-zinc-500" />
            Export Report
          </button>
          <button
            type="button"
            onClick={() => setIsNewOpen(true)}
            className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            <Plus className="size-4" />
            New Leave Request
          </button>
        </div>
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Pending Requests",
            value: `${pendingCount} Requests`,
            color: "text-amber-600",
          },
          {
            label: "Approved This Month",
            value: `${approvedCount} Approved`,
            color: "text-emerald-600",
          },
          {
            label: "Employees On Leave Today",
            value: `${onLeaveToday} On Leave`,
            color: "text-red-500",
          },
          {
            label: "Average Leave Balance",
            value: "18 Days",
            color: "text-blue-600",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between"
          >
            <span className="text-sm font-medium text-zinc-500">
              {stat.label}
            </span>
            <span
              className={cn(
                "text-2xl font-bold text-zinc-950 mt-2",
                stat.color,
              )}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main Content Layout: Left (Chart / Table), Right (Widgets) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          {/* Monthly Leave Requests Chart */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col">
            <h2 className="text-base font-bold text-zinc-950 mb-4">
              Monthly Leave Requests Trend
            </h2>
            <div className="h-[200px] w-full flex items-center justify-center">
              {!mounted ? (
                <div className="h-[200px] w-full bg-zinc-50 rounded-xl animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyLeaveData}
                    margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="leaveAreaGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#E4E4E7"
                          stopOpacity={0.6}
                        />
                        <stop
                          offset="100%"
                          stopColor="#E4E4E7"
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
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--text-disabled)", fontSize: 11 }}
                      domain={[0, 30]}
                      ticks={[0, 10, 20, 30]}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      wrapperStyle={{ zIndex: 50 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="#18181B"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#leaveAreaGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Filters Bar & Table */}
          <div className="flex flex-col gap-4">
            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative flex items-center">
                <Search className="absolute left-3 size-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search requests..."
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

              {/* Leave Type */}
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-lg text-sm text-zinc-700 bg-surface focus:outline-none focus:border-border-strong appearance-none cursor-pointer"
                >
                  <option disabled>Leave Type</option>
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "All" ? "All Types" : type}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 size-4 text-zinc-400 pointer-events-none" />
              </div>

              {/* Status & Clear Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
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
                {(search ||
                  selectedDept !== "All" ||
                  selectedType !== "All" ||
                  selectedStatus !== "All") && (
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

            {/* Leave Requests Table */}
            <div className="border border-border rounded-xl bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-border text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredRequests.length > 0 &&
                            selectedIds.length === filteredRequests.length
                          }
                          onChange={handleSelectAll}
                          className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-6 font-semibold">Employee</th>
                      <th className="py-3.5 px-6 font-semibold">Department</th>
                      <th className="py-3.5 px-6 font-semibold">Leave Type</th>
                      <th className="py-3.5 px-6 font-semibold">Duration</th>
                      <th className="py-3.5 px-6 font-semibold">From</th>
                      <th className="py-3.5 px-6 font-semibold">To</th>
                      <th className="py-3.5 px-6 font-semibold">Status</th>
                      <th className="py-3.5 px-6 font-semibold w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-zinc-700 font-medium">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-10 text-center text-zinc-400"
                        >
                          No requests found matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req) => (
                        <tr
                          key={req.id}
                          className="hover:bg-zinc-50/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(req.id)}
                              onChange={() => handleSelectRow(req.id)}
                              className="size-4 border-zinc-300 rounded text-zinc-950 focus:ring-zinc-950/20 cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-3">
                              <PersonAvatar
                                name={req.name}
                                size={32}
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-zinc-950 leading-tight truncate">
                                  {req.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                                  {req.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-6 text-zinc-500">
                            {req.department}
                          </td>
                          <td className="py-3.5 px-6 text-zinc-950">
                            {req.leaveType}
                          </td>
                          <td className="py-3.5 px-6 text-zinc-500 font-semibold">
                            {req.duration}
                          </td>
                          <td className="py-3.5 px-6 text-zinc-400">
                            {req.from}
                          </td>
                          <td className="py-3.5 px-6 text-zinc-400">
                            {req.to}
                          </td>
                          <td className="py-3.5 px-6">
                            <StatusBadge status={req.status} />
                          </td>
                          <td
                            className="py-3.5 px-6 text-right relative"
                            ref={activeMenuId === req.id ? dropdownRef : null}
                          >
                            <button
                              onClick={() =>
                                setActiveMenuId(
                                  activeMenuId === req.id ? null : req.id,
                                )
                              }
                              className="cursor-pointer p-1.5 rounded-lg border border-transparent hover:border-zinc-200 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>

                            {activeMenuId === req.id && (
                              <div className="absolute right-6 top-10 w-40 bg-surface border border-border rounded-lg shadow-lg py-1 z-40 text-left animate-in fade-in duration-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setActiveMenuId(null);
                                  }}
                                  className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                                >
                                  View Details
                                </button>
                                {req.status === "Pending" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => updateRequestStatus(req.id, "Approved")}
                                      className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                                    >
                                      Approve Request
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateRequestStatus(req.id, "Rejected")}
                                      className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                                    >
                                      Reject Request
                                    </button>
                                  </>
                                )}
                                <hr className="border-border my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLeaveRequests((current) =>
                                      current.filter((item) => item.id !== req.id),
                                    );
                                    toast.success("Request deleted");
                                    setActiveMenuId(null);
                                  }}
                                  className="cursor-pointer w-full text-left flex px-4 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-50"
                                >
                                  Delete Request
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

        {/* Right Column (Widgets) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Leave Balance Tracking */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <TrendingUp className="size-4 text-zinc-400" />
              Leave Balance Tracking
            </h3>
            <div className="flex flex-col gap-4">
              {leaveBalances.map((bal, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-zinc-900">{bal.type}</span>
                    <span className="text-zinc-500">{bal.balance}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", bal.color)}
                      style={{ width: `${bal.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Approval Panel */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <ActivityIcon className="size-4 text-zinc-400" />
              Pending Action List
            </h3>
            <div className="flex flex-col divide-y divide-border">
              {leaveRequests
                .filter((r) => r.status === "Pending")
                .map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-zinc-900 leading-tight truncate">
                        {req.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                        {req.leaveType} &bull; {req.duration}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateRequestStatus(req.id, "Approved")}
                        className="p-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors shadow-3xs cursor-pointer active:scale-95"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRequestStatus(req.id, "Rejected")}
                        className="p-1 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors shadow-3xs cursor-pointer active:scale-95"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Employees Currently On Leave */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <UserMinus className="size-4 text-zinc-400" />
              On Leave Today
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2.5 overflow-hidden">
                {activeLeavesToday.map((leave, i) => (
                  <PersonAvatar
                    key={i}
                    name={leave.name}
                    size={32}
                    title={leave.name}
                    className="-2 -white shadow-3xs cursor-pointer"
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-zinc-400 ml-1">
                {onLeaveToday} employees out today
              </span>
            </div>
          </div>

          {/* Mini Calendar */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <CalendarIcon className="size-4 text-zinc-400" />
              Leave Calendar
            </h3>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} className="text-zinc-400 py-1 font-semibold">
                  {day}
                </span>
              ))}
              {Array.from({ length: 31 }, (_, i) => {
                const day = i + 1;
                const isOnLeave = day === 14 || day === 15 || day === 20;
                return (
                  <span
                    key={day}
                    className={cn(
                      "py-1.5 rounded-lg flex items-center justify-center font-bold transition-all text-xs",
                      isOnLeave
                        ? "bg-zinc-100 text-zinc-900 border border-zinc-200"
                        : "text-zinc-700 hover:bg-zinc-50",
                    )}
                  >
                    {day}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <ActivityIcon className="size-4 text-zinc-400" />
              Activity Feed
            </h3>
            <div className="flex flex-col gap-3">
              {recentLeaveActivities.map((act, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <div className="size-2 bg-zinc-300 rounded-full mt-1.5 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <p className="text-zinc-800 leading-tight">{act.desc}</p>
                    <span className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                      {act.time} &bull; by {act.user}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="New Leave Request"
        description="Submit on behalf of an employee"
      >
        <div className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
            Employee name
            <input
              value={draftRequest.name}
              onChange={(e) =>
                setDraftRequest((current) => ({ ...current, name: e.target.value }))
              }
              className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Department
              <select
                value={draftRequest.department}
                onChange={(e) =>
                  setDraftRequest((current) => ({
                    ...current,
                    department: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              >
                {departments.filter((d) => d !== "All").map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              Leave type
              <select
                value={draftRequest.leaveType}
                onChange={(e) =>
                  setDraftRequest((current) => ({
                    ...current,
                    leaveType: e.target.value,
                  }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong cursor-pointer"
              >
                {leaveTypes.filter((t) => t !== "All").map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              From
              <input
                type="date"
                value={draftRequest.from}
                onChange={(e) =>
                  setDraftRequest((current) => ({ ...current, from: e.target.value }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-500">
              To
              <input
                type="date"
                value={draftRequest.to}
                onChange={(e) =>
                  setDraftRequest((current) => ({ ...current, to: e.target.value }))
                }
                className="h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleCreateRequest}
            className="cursor-pointer px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white active:scale-[0.98]"
          >
            Submit Request
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title="Leave Request"
        description={selectedRequest?.id}
      >
        {selectedRequest ? (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <PersonAvatar
                name={selectedRequest.name}
                size={48}
              />
              <div>
                <p className="text-sm font-bold text-zinc-950">{selectedRequest.name}</p>
                <p className="text-xs text-zinc-400">{selectedRequest.department}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div><span className="text-zinc-400">Type</span><p className="text-zinc-900 mt-1">{selectedRequest.leaveType}</p></div>
              <div><span className="text-zinc-400">Duration</span><p className="text-zinc-900 mt-1">{selectedRequest.duration}</p></div>
              <div><span className="text-zinc-400">From</span><p className="text-zinc-900 mt-1">{selectedRequest.from}</p></div>
              <div><span className="text-zinc-400">To</span><p className="text-zinc-900 mt-1">{selectedRequest.to}</p></div>
            </div>
            {selectedRequest.status === "Pending" ? (
              <div className="flex gap-3">
                <button type="button" onClick={() => updateRequestStatus(selectedRequest.id, "Approved")} className="cursor-pointer flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white text-sm font-semibold">Approve</button>
                <button type="button" onClick={() => updateRequestStatus(selectedRequest.id, "Rejected")} className="cursor-pointer flex-1 px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200/50 text-sm font-semibold">Reject</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
