"use client";

import { ChevronDown, ChevronRight, Info } from "lucide-react";
import React from "react";
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
import { cn } from "@/utils/cn";

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
  },
  {
    icon: PresentTodayIcon,
    bgStart: "#18181B",
    bgEnd: "#71717A",
    strokeColor: "39, 39, 42",
    shadowColor: "rgba(24, 24, 27, 0.15)",
    value: "231",
    subtext: "93% of Toal",
    subtextColor: "text-[#16A34A]",
    label: "Present Today",
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
  },
  {
    icon: OpenPositionIcon,
    bgStart: "#18181B",
    bgEnd: "#71717A",
    strokeColor: "39, 39, 42",
    shadowColor: "rgba(24, 24, 27, 0.15)",
    value: "8",
    subtext: "2 new this week",
    subtextColor: "text-[#1D4ED8]",
    label: "Open Position",
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
  },
];

const attendanceData = [
  { day: "Mon", attendance: 230 },
  { day: "Tue", attendance: 250 },
  { day: "Wed", attendance: 270 },
  { day: "Thurs", attendance: 110 },
  { day: "Fri", attendance: 300 },
  { day: "Sat", attendance: 190 },
];

const leaveRequests = [
  { name: "John Cena", type: "Sick Leave", duration: "2 days", status: "Pending" },
  { name: "Sarah Mills", type: "Annual Leave", duration: "1 days", status: "Approved" },
  { name: "Mark Lou", type: "Sick Leave", duration: "4 days", status: "Pending" },
  { name: "Kimi Nowa", type: "Personal Leave", duration: "2 days", status: "Rejected" },
];

const distributionData = [
  { name: "Engineering", value: 42, color: "#18181B", percentage: "42%" },
  { name: "HR", value: 12, color: "#D4D4D8", percentage: "12%" },
  { name: "Sales", value: 18, color: "#525252", percentage: "18%" },
  { name: "Marketing", value: 15, color: "#737373", percentage: "15%" },
  { name: "Finance", value: 13, color: "#A3A3A3", percentage: "13%" },
];

const activities = [
  { text: "John Doe approved leave for Sarah Johnson", time: "10 min ago" },
  { text: "John Doe approved leave for Sarah Johnson", time: "10 min ago" },
  { text: "John Doe approved leave for Sarah Johnson", time: "10 min ago" },
  { text: "John Doe approved leave for Sarah Johnson", time: "10 min ago" },
  { text: "John Doe approved leave for Sarah Johnson", time: "10 min ago" },
];

const getStatusStyle = (status: string) => {
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

const AttendanceTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface backdrop-blur-md border border-border px-3 py-1.5 rounded-md shadow-md text-xs font-semibold">
        <p className="text-zinc-900 font-bold">{label}</p>
        <p className="text-zinc-600">
          Attendance: <span className="text-zinc-950 font-bold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const DistributionTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="relative z-50 bg-surface backdrop-blur-md border border-border px-3 py-1.5 rounded-md shadow-md text-xs font-semibold">
        <p className="text-zinc-900 font-bold">{data.name}</p>
        <p className="text-zinc-600">
          Share: <span className="text-zinc-950 font-bold">{data.percentage}</span> ({data.value} Employees)
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-4 bg-surface flex flex-col">
      <h1 className="text-h1 font-medium">Dashboard</h1>
      <div className="flex items-center justify-between mt-6">
        <div className="flex flex-col">
          <h3 className="text-h3 font-semibold text-zinc-500">
            Good Morning,
            <span className="text-black dark:text-white"> William 👋</span>
          </h3>
          <p className="text-body-lg text-zinc-500 font-medium">
            Here what’s happening to your organisation today
          </p>
        </div>

        <button className="cursor-pointer flex gap-4 items-center justify-between pr-1 pl-1.5 py-1 border border-border rounded-sm text-body-lg text-zinc-700">
          17 July 2026
          <ChevronDown className="size-6 text-zinc-800" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between"
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
                <div className="flex items-baseline gap-2">
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
            </div>
          );
        })}
      </div>

      {/* Attendance Overview & Leave Request */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Attendance Overview */}
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h3 font-semibold text-zinc-900">Attendance Overview</h2>
            <button className="cursor-pointer flex gap-2 items-center justify-between px-3 py-1.5 border border-border rounded-md text-sm text-zinc-700 bg-surface">
              This week
              <ChevronDown className="size-4 text-zinc-500" />
            </button>
          </div>
          <div className="h-[250px] w-full flex items-center justify-center">
            {!mounted ? (
              <div className="h-[250px] w-full bg-zinc-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--divider)" />
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
                    domain={[0, 300]}
                    ticks={[0, 50, 100, 150, 200, 250, 300]}
                  />
                  <Tooltip content={<AttendanceTooltip />} cursor={{ fill: "rgba(0, 0, 0, 0.04)", radius: 6 }} />
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

        {/* Leave Request */}
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h3 font-semibold text-zinc-900">Leave Request</h2>
              <a href="#" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                View all
                <ChevronRight className="size-4" />
              </a>
            </div>
            <div className="flex flex-col">
              {leaveRequests.map((request, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b border-divider last:border-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 shrink-0" />
                  <div className="flex-1 ml-3">
                    <p className="text-sm font-semibold text-zinc-900 leading-tight">{request.name}</p>
                    <p className="text-xs text-zinc-500">{request.type}</p>
                  </div>
                  <div className="text-sm text-zinc-700 font-medium mr-4">
                    {request.duration}
                  </div>
                  <span className={cn("px-2.5 py-0.5 rounded-md text-xs font-semibold shrink-0 min-w-[75px] text-center", getStatusStyle(request.status))}>
                    {request.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Employee Distribution & Recent Activities */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Employee Distribution */}
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h3 font-semibold text-zinc-900">Employee Distribution</h2>
          </div>
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-[200px] h-[200px] flex items-center justify-center shrink-0">
              {!mounted ? (
                <div className="w-[180px] h-[180px] rounded-full bg-zinc-50 animate-pulse" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<DistributionTooltip />} wrapperStyle={{ zIndex: 50 }} />
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
                    <span className="text-xs text-zinc-400 font-semibold">Employees</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-4 pl-12">
              {distributionData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-zinc-700 font-medium">{item.name}</span>
                  </div>
                  <span className="text-zinc-900 font-semibold">{item.percentage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h3 font-semibold text-zinc-900">Recent Activities</h2>
              <a href="#" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                View all
                <ChevronRight className="size-4" />
              </a>
            </div>
            <div className="flex flex-col">
              {activities.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between py-3.5 border-b border-divider last:border-0">
                  <div className="flex items-center flex-1 min-w-0 mr-4">
                    <Info className="size-5 text-zinc-400 shrink-0 mr-3" />
                    <p className="text-sm text-zinc-800 font-medium truncate">{activity.text}</p>
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
