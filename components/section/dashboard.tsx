"use client";

import { ChevronDown, ChevronRight, Download, Plus } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import TotalEmployeeIcon from "@/components/icons/total-employee";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import OpenPositionIcon from "@/components/icons/open-position";
import PendingApprovalIcon from "@/components/icons/pending-approval";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/utils/cn";
import { toast } from "sonner";

type LeaveStatus = "Pending" | "Approved" | "Rejected";

type LeaveRequest = {
  id: string;
  name: string;
  email: string;
  department: string;
  type: string;
  duration: string;
  from: string;
  to: string;
  status: LeaveStatus;
};

const cards = [
  {
    icon: TotalEmployeeIcon,
    bgStart: "#18181B",
    bgEnd: "#71717A",
    strokeColor: "39, 39, 42",
    shadowColor: "rgba(24, 24, 27, 0.15)",
    value: "248",
    subtext: "+12 this month",
    subtextColor: "text-[#16A34A]",
    label: "Total employee",
    href: "/admin/people/employees",
  },
  {
    icon: PresentTodayIcon,
    bgStart: "#18181B",
    bgEnd: "#71717A",
    strokeColor: "39, 39, 42",
    shadowColor: "rgba(24, 24, 27, 0.15)",
    value: "231",
    subtext: "93% of total",
    subtextColor: "text-[#16A34A]",
    label: "Present Today",
    href: "/admin/people/attendance",
  },
  {
    icon: LeaveTodayIcon,
    bgStart: "#18181B",
    bgEnd: "#71717A",
    strokeColor: "39, 39, 42",
    shadowColor: "rgba(24, 24, 27, 0.15)",
    value: "11",
    subtext: "4% of total",
    subtextColor: "text-[#DC2626]",
    label: "Leave Today",
    href: "/admin/people/leave",
  },
  {
    icon: OpenPositionIcon,
    bgStart: "#18181B",
    bgEnd: "#71717A",
    strokeColor: "39, 39, 42",
    shadowColor: "rgba(24, 24, 27, 0.15)",
    value: "8",
    subtext: "2 new this week",
    subtextColor: "text-[#525252]",
    label: "Open Position",
    href: "/admin/hr/recruitment",
  },
  {
    icon: PendingApprovalIcon,
    bgStart: "#18181B",
    bgEnd: "#71717A",
    strokeColor: "39, 39, 42",
    shadowColor: "rgba(24, 24, 27, 0.15)",
    value: "14",
    subtext: "Leave & Payroll",
    subtextColor: "text-[#D97706]",
    label: "Pending Approvals",
    href: "/admin/people/leave",
  },
];

const attendanceByPeriod: Record<string, { day: string; attendance: number }[]> =
  {
    "This week": [
      { day: "Mon", attendance: 230 },
      { day: "Tue", attendance: 250 },
      { day: "Wed", attendance: 270 },
      { day: "Thurs", attendance: 110 },
      { day: "Fri", attendance: 300 },
      { day: "Sat", attendance: 190 },
    ],
    "Last week": [
      { day: "Mon", attendance: 215 },
      { day: "Tue", attendance: 238 },
      { day: "Wed", attendance: 255 },
      { day: "Thurs", attendance: 220 },
      { day: "Fri", attendance: 285 },
      { day: "Sat", attendance: 175 },
    ],
    "This month": [
      { day: "W1", attendance: 980 },
      { day: "W2", attendance: 1040 },
      { day: "W3", attendance: 990 },
      { day: "W4", attendance: 1120 },
    ],
  };

const dateOptions = [
  "17 July 2026",
  "16 July 2026",
  "15 July 2026",
  "10 July 2026",
  "1 July 2026",
];

const initialLeaveRequests: LeaveRequest[] = [
  {
    id: "REQ-D001",
    name: "John Cena",
    email: "john.cena@organization.com",
    department: "Engineering",
    type: "Sick Leave",
    duration: "2 days",
    from: "18 Jul 2026",
    to: "19 Jul 2026",
    status: "Pending",
  },
  {
    id: "REQ-D002",
    name: "Sarah Mills",
    email: "sarah.mills@organization.com",
    department: "HR",
    type: "Annual Leave",
    duration: "1 day",
    from: "20 Jul 2026",
    to: "20 Jul 2026",
    status: "Approved",
  },
  {
    id: "REQ-D003",
    name: "Mark Lou",
    email: "mark.lou@organization.com",
    department: "Sales",
    type: "Sick Leave",
    duration: "4 days",
    from: "22 Jul 2026",
    to: "25 Jul 2026",
    status: "Pending",
  },
  {
    id: "REQ-D004",
    name: "Kimi Nowa",
    email: "kimi.nowa@organization.com",
    department: "Marketing",
    type: "Personal Leave",
    duration: "2 days",
    from: "14 Jul 2026",
    to: "15 Jul 2026",
    status: "Rejected",
  },
];

const distributionData = [
  {
    name: "Engineering",
    value: 42,
    color: "#18181B",
    percentage: "42%",
    lead: "Bruce Banner",
  },
  {
    name: "HR",
    value: 12,
    color: "#D4D4D8",
    percentage: "12%",
    lead: "Sarah Mills",
  },
  {
    name: "Sales",
    value: 18,
    color: "#525252",
    percentage: "18%",
    lead: "William Vance",
  },
  {
    name: "Marketing",
    value: 15,
    color: "#737373",
    percentage: "15%",
    lead: "Emma Watson",
  },
  {
    name: "Finance",
    value: 13,
    color: "#A3A3A3",
    percentage: "13%",
    lead: "William Vance",
  },
];

const activities = [
  {
    id: "ACT1",
    actor: "Sarah Mills",
    text: "approved leave for John Cena",
    time: "10 min ago",
  },
  {
    id: "ACT2",
    actor: "William Joseph",
    text: "exported payroll report for July",
    time: "32 min ago",
  },
  {
    id: "ACT3",
    actor: "Bruce Banner",
    text: "added a new candidate to Engineering pipeline",
    time: "1 hr ago",
  },
  {
    id: "ACT4",
    actor: "Emma Watson",
    text: "updated marketing headcount forecast",
    time: "2 hr ago",
  },
  {
    id: "ACT5",
    actor: "Mark Lou",
    text: "submitted attendance correction request",
    time: "3 hr ago",
  },
];

const getStatusStyle = (status: LeaveStatus) => {
  switch (status) {
    case "Approved":
      return "bg-success-soft border border-success/30 text-success";
    case "Rejected":
      return "bg-error-soft border border-error/30 text-error";
    case "Pending":
    default:
      return "bg-warning-soft border border-warning/30 text-warning";
  }
};

const AttendanceTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface backdrop-blur-md border border-border px-3 py-1.5 rounded-md shadow-md text-xs font-semibold">
        <p className="text-zinc-900 font-bold">{label}</p>
        <p className="text-zinc-600">
          Attendance:{" "}
          <span className="text-zinc-950 font-bold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const DistributionTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: (typeof distributionData)[number] }[];
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="relative z-50 bg-surface backdrop-blur-md border border-border px-3 py-1.5 rounded-md shadow-md text-xs font-semibold">
        <p className="text-zinc-900 font-bold">{data.name}</p>
        <p className="text-zinc-600">
          Share:{" "}
          <span className="text-zinc-950 font-bold">{data.percentage}</span> (
          {data.value} Employees)
        </p>
      </div>
    );
  }
  return null;
};

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [ref, handler, enabled]);
}

const Dashboard = () => {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0]);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [chartPeriod, setChartPeriod] =
    useState<keyof typeof attendanceByPeriod>("This week");
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequest[]>(initialLeaveRequests);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<
    (typeof distributionData)[number] | null
  >(null);
  const [selectedActivity, setSelectedActivity] = useState<
    (typeof activities)[number] | null
  >(null);

  const dateRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);

  useClickOutside(dateRef, () => setIsDateOpen(false), isDateOpen);
  useClickOutside(periodRef, () => setIsPeriodOpen(false), isPeriodOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateLeaveStatus = (id: string, status: LeaveStatus) => {
    setLeaveRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, status } : request,
      ),
    );
    setSelectedLeave((current) =>
      current?.id === id ? { ...current, status } : current,
    );
    if (status === "Approved") {
      toast.success("Leave request approved");
    } else {
      toast.warning("Leave request rejected");
    }
  };

  const attendanceData = attendanceByPeriod[chartPeriod];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col text-left">
          <h1 className="text-h1 font-medium">Dashboard</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Overview of people, attendance, and approvals across your
            organisation.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              toast("Export started", {
                description: "Your dashboard report will download shortly.",
              })
            }
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-surface hover:bg-surface-hover hover:border-border-strong text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color,border-color] duration-150 ease-out"
          >
            <Download className="size-4" />
            Export Report
          </button>
          <Link
            href="/admin/people/employees"
            className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
          >
            <Plus className="size-4" />
            Add Employee
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col text-left">
          <h3 className="text-h3 font-semibold text-zinc-500">
            Good Morning,
            <span className="text-black dark:text-white"> William 👋</span>
          </h3>
          <p className="text-body-lg text-zinc-500 font-medium">
            Here&apos;s what&apos;s happening in your organisation today.
          </p>
        </div>

        <div className="relative shrink-0" ref={dateRef}>
          <button
            type="button"
            onClick={() => setIsDateOpen((open) => !open)}
            aria-expanded={isDateOpen}
            aria-haspopup="listbox"
            className={cn(
              "cursor-pointer flex gap-3 items-center justify-between min-w-[180px] px-3 py-2 border rounded-lg text-sm font-semibold text-zinc-700 bg-surface shadow-2xs active:scale-[0.98] transition-[transform,border-color,background-color] duration-150 ease-out",
              isDateOpen
                ? "border-border-strong bg-surface-hover"
                : "border-border hover:border-border-strong hover:bg-surface-hover",
            )}
          >
            {selectedDate}
            <ChevronDown
              className={cn(
                "size-4 text-zinc-500 transition-transform duration-200 ease-out",
                isDateOpen && "rotate-180",
              )}
            />
          </button>
          {isDateOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-full min-w-[200px] bg-surface border border-border rounded-2xl shadow-lg py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right">
              {dateOptions.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setSelectedDate(date);
                    setIsDateOpen(false);
                  }}
                  className={cn(
                    "cursor-pointer w-full text-left px-3 py-2 text-xs font-semibold rounded-lg mx-1.5 transition-colors duration-150 ease-out",
                    selectedDate === date
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-700 hover:bg-surface-hover",
                  )}
                  style={{ width: "calc(100% - 12px)" }}
                >
                  {date}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between min-h-[140px] hover:border-border-strong hover:shadow-sm active:scale-[0.99] transition-[transform,box-shadow,border-color] duration-200 ease-out cursor-pointer select-none"
            >
              <div className="flex flex-col gap-6">
                <div
                  className="size-12 rounded-lg flex items-center justify-center text-white"
                  style={{
                    outline: `1px solid rgba(${card.strokeColor},0.5)`,
                    outlineOffset: "-1px",
                    background: `linear-gradient(to top, ${card.bgStart}, ${card.bgEnd}) padding-box, linear-gradient(to bottom, rgba(${card.strokeColor}, 0.5) 0%, rgba(${card.strokeColor}, 0) 59%) border-box`,
                    boxShadow: `0 0 0 1px ${card.shadowColor}`,
                  }}
                >
                  <Icon className="size-[30px]" />
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-h1 font-bold text-zinc-950 leading-none">
                    {card.value}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold leading-none",
                      card.subtextColor,
                    )}
                  >
                    {card.subtext}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-body-lg text-primary font-medium">
                {card.label}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h3 font-semibold text-zinc-900">
              Attendance Overview
            </h2>
            <div className="relative" ref={periodRef}>
              <button
                type="button"
                onClick={() => setIsPeriodOpen((open) => !open)}
                aria-expanded={isPeriodOpen}
                aria-haspopup="listbox"
                className={cn(
                  "cursor-pointer flex gap-2 items-center justify-between px-3 py-1.5 border rounded-lg text-sm font-semibold text-zinc-700 bg-surface shadow-2xs active:scale-[0.98] transition-[transform,border-color,background-color] duration-150 ease-out",
                  isPeriodOpen
                    ? "border-border-strong bg-surface-hover"
                    : "border-border hover:border-border-strong hover:bg-surface-hover",
                )}
              >
                {chartPeriod}
                <ChevronDown
                  className={cn(
                    "size-4 text-zinc-500 transition-transform duration-200 ease-out",
                    isPeriodOpen && "rotate-180",
                  )}
                />
              </button>
              {isPeriodOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[160px] bg-surface border border-border rounded-2xl shadow-lg py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 origin-top-right">
                  {(Object.keys(attendanceByPeriod) as Array<
                    keyof typeof attendanceByPeriod
                  >).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setChartPeriod(period);
                        setIsPeriodOpen(false);
                      }}
                      className={cn(
                        "cursor-pointer w-full text-left px-3 py-2 text-xs font-semibold rounded-lg mx-1.5 transition-colors duration-150 ease-out",
                        chartPeriod === period
                          ? "bg-zinc-950 text-white"
                          : "text-zinc-700 hover:bg-surface-hover",
                      )}
                      style={{ width: "calc(100% - 12px)" }}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="h-[250px] w-full flex items-center justify-center">
            {!mounted ? (
              <div className="h-[250px] w-full bg-zinc-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={attendanceData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E4E4E7" />
                      <stop offset="100%" stopColor="#18181B" />
                    </linearGradient>
                    <linearGradient id="barStrokeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#18181B" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#18181B" stopOpacity={0} />
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
                    tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--text-disabled)", fontSize: 12 }}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    content={<AttendanceTooltip />}
                    cursor={{ fill: "rgba(0, 0, 0, 0.04)", radius: 6 }}
                  />
                  <Bar
                    dataKey="attendance"
                    fill="url(#attendanceGrad)"
                    stroke="url(#barStrokeGrad)"
                    strokeWidth={1}
                    radius={[12, 12, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h3 font-semibold text-zinc-900">Leave Request</h2>
            <Link
              href="/admin/people/leave"
              className="cursor-pointer text-sm font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors duration-150 ease-out"
            >
              View all
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="flex flex-col">
            {leaveRequests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setSelectedLeave(request)}
                className="cursor-pointer flex items-center justify-between py-3 border-b border-divider last:border-0 text-left hover:bg-surface-hover/60 -mx-2 px-2 rounded-lg transition-colors duration-150 ease-out active:scale-[0.995]"
              >
                <PersonAvatar
                  name={request.name}
                  size={40}
                />
                <div className="flex-1 ml-3 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 leading-tight truncate">
                    {request.name}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{request.type}</p>
                </div>
                <div className="text-sm text-zinc-700 font-medium mr-4 shrink-0">
                  {request.duration}
                </div>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-md text-xs font-semibold shrink-0 min-w-[75px] text-center",
                    getStatusStyle(request.status),
                  )}
                >
                  {request.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h3 font-semibold text-zinc-900">
              Employee Distribution
            </h2>
            <Link
              href="/admin/people/department"
              className="cursor-pointer text-sm font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors duration-150 ease-out"
            >
              View departments
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-[200px] h-[200px] flex items-center justify-center shrink-0">
              {!mounted ? (
                <div className="w-[180px] h-[180px] rounded-full bg-zinc-50 animate-pulse" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        content={<DistributionTooltip />}
                        wrapperStyle={{ zIndex: 50 }}
                      />
                      <Pie
                        data={distributionData}
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        cornerRadius={6}
                        dataKey="value"
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-zinc-950">248</span>
                    <span className="text-xs text-zinc-400 font-semibold">
                      Employees
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-3 pl-4 lg:pl-12">
              {distributionData.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedDepartment(item)}
                  className="cursor-pointer flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-hover transition-colors duration-150 ease-out active:scale-[0.99] text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-zinc-700 font-medium truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-zinc-900 font-semibold shrink-0">
                    {item.percentage}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h3 font-semibold text-zinc-900">
              Recent Activities
            </h2>
            <Link
              href="/admin/notifications"
              className="cursor-pointer text-sm font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors duration-150 ease-out"
            >
              View all
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="flex flex-col">
            {activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() => setSelectedActivity(activity)}
                className="cursor-pointer flex items-center justify-between py-3.5 border-b border-divider last:border-0 text-left hover:bg-surface-hover/60 -mx-2 px-2 rounded-lg transition-colors duration-150 ease-out active:scale-[0.995]"
              >
                <div className="flex items-center flex-1 min-w-0 mr-4 gap-3">
                  <PersonAvatar
                    name={activity.actor}
                    size={40}
                  />
                  <p className="text-sm text-zinc-800 font-medium truncate">
                    <span className="font-semibold text-zinc-950">
                      {activity.actor}
                    </span>{" "}
                    {activity.text}
                  </p>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">
                  {activity.time}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(selectedLeave)}
        onClose={() => setSelectedLeave(null)}
        title="Leave Request"
        description={selectedLeave?.id}
      >
        {selectedLeave ? (
          <div className="flex flex-col gap-5 text-left">
            <div className="flex items-center gap-4">
              <PersonAvatar
                name={selectedLeave.name}
                size={48}
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-950">
                  {selectedLeave.name}
                </p>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5 truncate">
                  {selectedLeave.email}
                </p>
                <span
                  className={cn(
                    "inline-flex mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                    getStatusStyle(selectedLeave.status),
                  )}
                >
                  {selectedLeave.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div className="flex flex-col gap-1">
                <span className="text-zinc-400">Department</span>
                <span className="text-zinc-900">{selectedLeave.department}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-400">Leave type</span>
                <span className="text-zinc-900">{selectedLeave.type}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-400">Duration</span>
                <span className="text-zinc-900">{selectedLeave.duration}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-400">Dates</span>
                <span className="text-zinc-900">
                  {selectedLeave.from} – {selectedLeave.to}
                </span>
              </div>
            </div>

            {selectedLeave.status === "Pending" ? (
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => updateLeaveStatus(selectedLeave.id, "Approved")}
                  className="cursor-pointer flex-1 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => updateLeaveStatus(selectedLeave.id, "Rejected")}
                  className="cursor-pointer flex-1 px-3.5 py-2 rounded-lg border border-red-200/50 bg-red-50 text-red-700 hover:bg-red-100/50 text-sm font-semibold active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
                >
                  Reject
                </button>
              </div>
            ) : (
              <Link
                href="/admin/people/leave"
                onClick={() => setSelectedLeave(null)}
                className="cursor-pointer inline-flex items-center justify-center px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color,border-color] duration-150 ease-out"
              >
                Open in Leave Management
              </Link>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedDepartment)}
        onClose={() => setSelectedDepartment(null)}
        title={selectedDepartment?.name ?? "Department"}
        description="Headcount breakdown"
      >
        {selectedDepartment ? (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-center gap-4">
              <PersonAvatar
                name={selectedDepartment.lead}
                size={48}
              />
              <div>
                <p className="text-sm font-bold text-zinc-950">
                  {selectedDepartment.lead}
                </p>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                  Department lead
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div className="flex flex-col gap-1">
                <span className="text-zinc-400">Employees</span>
                <span className="text-zinc-900">{selectedDepartment.value}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-400">Organisation share</span>
                <span className="text-zinc-900">
                  {selectedDepartment.percentage}
                </span>
              </div>
            </div>
            <Link
              href="/admin/people/department"
              onClick={() => setSelectedDepartment(null)}
              className="cursor-pointer inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out"
            >
              View department
            </Link>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        title="Activity Detail"
        description={selectedActivity?.time}
      >
        {selectedActivity ? (
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-center gap-4">
              <PersonAvatar
                name={selectedActivity.actor}
                size={48}
              />
              <div>
                <p className="text-sm font-bold text-zinc-950">
                  {selectedActivity.actor}
                </p>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                  {selectedActivity.time}
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-700 font-medium leading-relaxed">
              {selectedActivity.actor} {selectedActivity.text}.
            </p>
            <Link
              href="/admin/notifications"
              onClick={() => setSelectedActivity(null)}
              className="cursor-pointer inline-flex items-center justify-center px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold text-zinc-700 shadow-2xs active:scale-[0.98] transition-[transform,background-color,border-color] duration-150 ease-out"
            >
              View notifications
            </Link>
          </div>
        ) : null}
      </Modal>

    </div>
  );
};

export default Dashboard;
