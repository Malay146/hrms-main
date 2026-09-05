"use client";

import { ChevronRight, Info } from "lucide-react";
import React from "react";
import Link from "next/link";
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
import { PersonAvatar } from "@/components/ui/person-avatar";
import { BarChartTooltip, PieChartTooltip, chartCursor, chartTooltipWrapperStyle } from "@/components/charts/chart-tooltip";
import type { DashboardStats } from "@/lib/shared/types";
import type { PayrollDashboardData } from "@/lib/actions/payroll/payroll-dashboard";

function SalaryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <BarChartTooltip
      active
      label={label}
      payload={[{ value: `₹${value.toLocaleString("en-IN")}` }]}
      valueLabel="Monthly wage cost"
    />
  );
}

export default function Dashboard({
  stats,
  payroll,
  filters,
}: {
  stats: DashboardStats;
  payroll?: PayrollDashboardData;
  filters?: { periodStart: string; periodEnd: string; department: string; employeeType: string };
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const teamPct = (count: number) =>
    stats.totalEmployees === 0 ? "0% of team" : `${Math.round((count / stats.totalEmployees) * 100)}% of team`;
  const departmentCount = stats.distribution.length;

  const cards = [
    {
      icon: TotalEmployeeIcon,
      value: String(stats.totalEmployees),
      subtext: `${departmentCount} department${departmentCount === 1 ? "" : "s"}`,
      subtextColor: "text-[#16A34A]",
      label: "Total employee",
    },
    {
      icon: PresentTodayIcon,
      value: String(stats.presentToday),
      subtext: teamPct(stats.presentToday),
      subtextColor: "text-[#16A34A]",
      label: "Present Today",
    },
    {
      icon: LeaveTodayIcon,
      value: String(stats.leaveToday),
      subtext: teamPct(stats.leaveToday),
      subtextColor: "text-[#DC2626]",
      label: "Leave Today",
    },
    payroll?.canViewPayroll
      ? {
          icon: OpenPositionIcon,
          value: `₹${Math.round(payroll.totalNetPaid).toLocaleString("en-IN")}`,
          subtext: `${payroll.payslipsPaid} paid`,
          subtextColor: "text-[#16A34A]",
          label: "Total net salary paid",
        }
      : {
          icon: OpenPositionIcon,
          value: "—",
          subtext: "No payroll access",
          subtextColor: "text-zinc-500",
          label: "Total net salary paid",
        },
    {
      icon: PendingApprovalIcon,
      value: String(stats.pendingApprovals),
      subtext: stats.pendingApprovals === 0 ? "All clear" : "Awaiting review",
      subtextColor: "text-[#D97706]",
      label: "Pending Approvals",
    },
  ];

  const maxAttendance = Math.max(1, ...stats.weeklyAttendance.map((row) => row.attendance));

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-4 bg-surface flex flex-col">
      <h1 className="text-h1 font-medium">Dashboard</h1>
      <div className="flex items-center justify-between mt-6">
        <div className="flex flex-col">
          <h3 className="text-h3 font-semibold text-zinc-500">
            {stats.greeting},
            <span className="text-black dark:text-white"> {stats.firstName} 👋</span>
          </h3>
          <p className="text-body-lg text-zinc-500 font-medium">
            Here what’s happening to your organisation {stats.todayLabel ? `on ${stats.todayLabel}` : "today"}
          </p>
        </div>
        <form className="flex flex-wrap gap-2 items-end" method="get">
          <label className="text-xs font-semibold text-zinc-500">
            From
            <input type="date" name="from" defaultValue={filters?.periodStart} className="ml-2 h-9 px-2 border border-border rounded-lg text-sm" />
          </label>
          <label className="text-xs font-semibold text-zinc-500">
            To
            <input type="date" name="to" defaultValue={filters?.periodEnd} className="ml-2 h-9 px-2 border border-border rounded-lg text-sm" />
          </label>
          <label className="text-xs font-semibold text-zinc-500">
            Department
            <select name="department" defaultValue={filters?.department ?? ""} className="ml-2 h-9 px-2 border border-border rounded-lg text-sm">
              <option value="">All Departments</option>
              {(payroll?.departments ?? []).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-zinc-500">
            Type
            <select name="type" defaultValue={filters?.employeeType ?? ""} className="ml-2 h-9 px-2 border border-border rounded-lg text-sm">
              <option value="">All Types</option>
              <option value="full_time">Full time</option>
              <option value="intern">Intern</option>
              <option value="contractor">Contractor</option>
            </select>
          </label>
          <button type="submit" className="h-9 px-3 rounded-lg bg-zinc-900 text-white text-sm font-semibold">
            Apply
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="border border-border rounded-xl p-5 bg-surface flex flex-col justify-between">
              <div className="flex flex-col gap-6">
                <div
                  className="size-12 rounded-lg flex items-center justify-center text-white"
                  style={{ background: "linear-gradient(to top, #18181B, #71717A)" }}
                >
                  <Icon className="size-[30px]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-h1 font-bold text-zinc-950 leading-none">{card.value}</span>
                  <span className={cn("text-sm font-semibold leading-none", card.subtextColor)}>{card.subtext}</span>
                </div>
              </div>
              <p className="mt-2 text-body-lg text-primary font-medium">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h3 font-semibold text-zinc-900">Attendance Overview</h2>
          </div>
          <div className="h-[250px] w-full">
            {!mounted ? (
              <div className="h-[250px] w-full bg-zinc-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E4E4E7" />
                      <stop offset="100%" stopColor="#18181B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--divider)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-disabled)", fontSize: 12 }} domain={[0, maxAttendance]} />
                  <Tooltip
                    content={<BarChartTooltip valueLabel="Present / half-day" />}
                    cursor={chartCursor}
                    wrapperStyle={chartTooltipWrapperStyle}
                  />
                  <Bar dataKey="attendance" fill="url(#attendanceGrad)" radius={[12, 12, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h3 font-semibold text-zinc-900">Leave Request</h2>
            <Link href="/admin/people/leave" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
              View all
              <ChevronRight className="size-4" />
            </Link>
          </div>
          {stats.recentLeaves.length === 0 ? (
            <p className="py-12 text-center text-sm font-medium text-zinc-400">No leave requests yet</p>
          ) : (
            stats.recentLeaves.map((request) => (
              <div key={request.id} className="flex items-center justify-between py-3 border-b border-divider last:border-0">
                <PersonAvatar name={request.name} size={40} />
                <div className="flex-1 ml-3">
                  <p className="text-sm font-semibold text-zinc-900 leading-tight">{request.name}</p>
                  <p className="text-xs text-zinc-500">{request.leaveType}</p>
                </div>
                <div className="text-sm text-zinc-700 font-medium mr-4">{request.duration}</div>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-md text-xs font-semibold shrink-0 min-w-[75px] text-center",
                  request.status === "Approved" && "bg-success-soft border border-success/30 text-success",
                  request.status === "Rejected" && "bg-error-soft border border-error/30 text-error",
                  request.status === "Pending" && "bg-warning-soft border border-warning/30 text-warning",
                )}>
                  {request.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface">
          <h2 className="text-h3 font-semibold text-zinc-900 mb-6">Employee Distribution</h2>
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-[200px] h-[200px] flex items-center justify-center shrink-0">
              {!mounted ? (
                <div className="w-[180px] h-[180px] rounded-full bg-zinc-50 animate-pulse" />
              ) : (
                <>
                  <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-zinc-950">{stats.totalEmployees}</span>
                    <span className="text-xs text-zinc-400 font-semibold">Employees</span>
                  </div>
                  <div className="relative z-10 h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          content={<PieChartTooltip valueLabel="Employees" />}
                          wrapperStyle={chartTooltipWrapperStyle}
                        />
                        <Pie
                          data={stats.distribution}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          cornerRadius={6}
                          dataKey="value"
                          nameKey="name"
                          stroke="none"
                          className="outline-none cursor-pointer"
                        >
                          {stats.distribution.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} className="outline-none transition-opacity hover:opacity-90" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-4 pl-6">
              {stats.distribution.length === 0 ? (
                <p className="text-sm font-medium text-zinc-400">No employees to distribute yet</p>
              ) : (
                stats.distribution.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-zinc-700 font-medium">{item.name}</span>
                    </div>
                    <span className="text-zinc-900 font-semibold">{item.percentage}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface">
          <h2 className="text-h3 font-semibold text-zinc-900 mb-4">Recent Activities</h2>
          {stats.activities.length === 0 ? (
            <p className="py-12 text-center text-sm font-medium text-zinc-400">No recent activity</p>
          ) : (
            stats.activities.map((activity, idx) => (
              <div key={`${activity.text}-${idx}`} className="flex items-center justify-between py-3.5 border-b border-divider last:border-0">
                <div className="flex items-center flex-1 min-w-0 mr-4">
                  <Info className="size-5 text-zinc-400 shrink-0 mr-3" />
                  <p className="text-sm text-zinc-800 font-medium truncate">{activity.text}</p>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">{activity.time}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {stats.performance ? (
        <div className="grid grid-cols-12 gap-6 mt-6">
          <div className="col-span-12 border border-border rounded-2xl p-6 bg-surface">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h3 font-semibold text-zinc-900">Performance</h2>
              <Link href={stats.performance.href} className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                View all
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-border rounded-xl p-4">
                <p className="text-sm font-medium text-zinc-500">Average rating</p>
                <p className="text-h1 font-semibold mt-2">
                  {stats.performance.avgRating == null ? "—" : stats.performance.avgRating.toFixed(1)}
                </p>
              </div>
              <div className="border border-border rounded-xl p-4">
                <p className="text-sm font-medium text-zinc-500">Draft reviews</p>
                <p className="text-h1 font-semibold mt-2">{stats.performance.pendingReviews}</p>
              </div>
              <div className="border border-border rounded-xl p-4">
                <p className="text-sm font-medium text-zinc-500">Awaiting acknowledgement</p>
                <p className="text-h1 font-semibold mt-2">{stats.performance.submittedReviews}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6 mt-6">
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface">
          <h2 className="text-h3 font-semibold text-zinc-900 mb-4">Salary cost by department</h2>
          <div className="h-[220px]">
            {!payroll?.canViewPayroll ? (
              <p className="py-12 text-center text-sm font-medium text-zinc-400">No payroll access</p>
            ) : !mounted ? (
              <div className="h-full bg-zinc-50 rounded-xl animate-pulse" />
            ) : payroll.salaryByDepartment.length === 0 ? (
              <p className="py-12 text-center text-sm font-medium text-zinc-400">No salary cost data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payroll.salaryByDepartment} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                  <defs>
                    <linearGradient id="salaryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E4E4E7" />
                      <stop offset="100%" stopColor="#18181B" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--divider)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={50}
                    tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--text-disabled)", fontSize: 12 }}
                    tickFormatter={(v) => (v >= 100000 ? `${Math.round(v / 100000) / 10}L` : `${Math.round(v / 1000)}k`)}
                  />
                  <Tooltip
                    content={<SalaryTooltip />}
                    cursor={chartCursor}
                    wrapperStyle={chartTooltipWrapperStyle}
                  />
                  <Bar dataKey="value" fill="url(#salaryGrad)" radius={[12, 12, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col gap-3">
          <h2 className="text-h3 font-semibold text-zinc-900">Payroll alerts & attendance</h2>
          <p className="text-sm text-zinc-500">
            Attendance health {payroll?.attendanceHealth ?? 0}% · Present {payroll?.present ?? 0} · Late{" "}
            {payroll?.late ?? 0} · Absent {payroll?.absent ?? 0} · On leave {payroll?.leaveToday ?? 0} · Missing
            check-outs {payroll?.missingCheckout ?? 0}
          </p>
          <p className="text-sm text-zinc-500">Approved time off days (period): {payroll?.approvedTimeOffDays ?? 0}</p>
          {(payroll?.alerts.length ?? 0) === 0 ? (
            <p className="text-sm font-medium text-zinc-400">No payroll alerts</p>
          ) : (
            payroll?.alerts.map((alert) => (
              <p key={alert} className="text-sm font-medium text-zinc-800">• {alert}</p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
