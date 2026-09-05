"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import TotalEmployeeIcon from "@/components/icons/total-employee";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import PendingApprovalIcon from "@/components/icons/pending-approval";
import TotalPayrollIcon from "@/components/icons/total-payroll";
import AiIcon from "@/components/icons/sidebar/ai";
import { cn } from "@/utils/cn";
import { generateAiInsights, refreshAiAnalyticsAction } from "@/lib/actions/ai";
import type { AiAnalyticsData, AiInsightCard } from "@/lib/shared/types";
import { BarChartTooltip, PieChartTooltip, chartCursor, chartTooltipWrapperStyle } from "@/components/charts/chart-tooltip";
import { ListPagination, useClientPagination } from "@/components/ui/list-pagination";
import { useRouter } from "next/navigation";

const HEALTH_BADGE = {
  healthy: { variant: "success" as const, label: "Healthy" },
  watch: { variant: "warning" as const, label: "Watch" },
  at_risk: { variant: "destructive" as const, label: "At risk" },
};

const INSIGHT_BADGE = {
  info: "success" as const,
  watch: "warning" as const,
  alert: "destructive" as const,
};

export default function AnalyticsClient({ data }: { data: AiAnalyticsData }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [insights, setInsights] = useState<AiInsightCard[]>(data.insights);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const healthBadge = HEALTH_BADGE[data.health.band];
  const maxAttendance = Math.max(1, ...data.weeklyAttendance.map((row) => row.attendance));
  const payrollLabel =
    data.payrollNet == null ? "—" : `₹${Math.round(data.payrollNet).toLocaleString("en-IN")}`;

  const deptPaging = useClientPagination(data.departmentAttendance, 8, data.periodLabel);
  const insightPaging = useClientPagination(insights, 4, insights.length);
  const flightPaging = useClientPagination(data.flightRisk, 10, data.flightRisk.length);

  const cards = [
    {
      icon: TotalEmployeeIcon,
      value: String(data.health.score),
      subtext: healthBadge.label,
      subtextColor:
        data.health.band === "healthy"
          ? "text-[#16A34A]"
          : data.health.band === "watch"
            ? "text-[#D97706]"
            : "text-[#DC2626]",
      label: "Workforce health",
    },
    {
      icon: PresentTodayIcon,
      value: `${data.attendancePct}%`,
      subtext: `${data.latePct}% late`,
      subtextColor: data.latePct > 15 ? "text-[#D97706]" : "text-[#16A34A]",
      label: "Attendance rate",
    },
    {
      icon: LeaveTodayIcon,
      value: String(data.leaveDaysApproved),
      subtext: "Approved days",
      subtextColor: "text-[#DC2626]",
      label: "Leave load",
    },
    {
      icon: PendingApprovalIcon,
      value: String(data.pendingApprovals),
      subtext: "Awaiting review",
      subtextColor: "text-[#D97706]",
      label: "Pending leave",
    },
    {
      icon: TotalPayrollIcon,
      value: payrollLabel,
      subtext: data.payrollNet == null ? "No payroll access" : "Latest paid net",
      subtextColor: "text-zinc-500",
      label: "Payroll net",
    },
  ];

  async function onRefresh() {
    setRefreshing(true);
    const snap = await refreshAiAnalyticsAction();
    if (!snap.ok) {
      setRefreshing(false);
      toast(snap.error);
      return;
    }
    if (data.aiEnabled) {
      const result = await generateAiInsights();
      if (result.ok) {
        setInsights(result.data);
      } else {
        toast(result.error);
      }
    }
    setRefreshing(false);
    toast("Analytics snapshot refreshed.");
    router.refresh();
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col text-left">
          <h1 className="text-h1 font-medium">AI Analytics</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Workforce metrics and analysis for {data.periodLabel}.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="cursor-pointer rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-4 py-2 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh analytics"}
        </button>
      </div>

      {!data.aiEnabled ? (
        <p className="w-fit text-sm font-medium text-zinc-500 border border-border rounded-xl px-4 py-3">
          Connect an AI provider to generate written analysis. Metrics below are live without a model.
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-500">Health band</span>
        <Badge variant={healthBadge.variant}>{healthBadge.label}</Badge>
        <span className="text-sm font-medium text-zinc-500">
          Avg review {data.performance.avgRating == null ? "—" : `${data.performance.avgRating}/5`}
          {" · "}
          {data.performance.pendingReviews} drafts
          {" · "}
          {data.performance.submittedReviews} awaiting ack
        </span>
        <Link href="/admin/hr/performance" className="text-sm font-semibold text-zinc-900 hover:underline">
          Open performance
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface flex flex-col">
          <h2 className="text-h3 font-semibold text-zinc-900 mb-6">Attendance trend</h2>
          <div className="h-[250px] w-full">
            {!mounted ? (
              <div className="h-[250px] w-full bg-zinc-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.weeklyAttendance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aiAttendanceGrad" x1="0" y1="0" x2="0" y2="1">
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
                  <Bar dataKey="attendance" fill="url(#aiAttendanceGrad)" radius={[12, 12, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 border border-border rounded-2xl p-6 bg-surface">
          <h2 className="text-h3 font-semibold text-zinc-900 mb-6">Leave by type</h2>
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-[200px] h-[200px] flex items-center justify-center shrink-0">
              {!mounted ? (
                <div className="w-[180px] h-[180px] rounded-full bg-zinc-50 animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={<PieChartTooltip valueLabel="Requests" />}
                      wrapperStyle={chartTooltipWrapperStyle}
                    />
                    <Pie
                      data={data.leaveByType}
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      cornerRadius={6}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                      className="outline-none cursor-pointer"
                    >
                      {data.leaveByType.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} className="outline-none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-4 pl-6">
              {data.leaveByType.map((item) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-h3 font-semibold text-zinc-900">Attendance by department</h2>
          <p className="text-sm text-zinc-500 font-medium">Present rate for the current 30-day window.</p>
        </div>
        {data.departmentAttendance.length === 0 ? (
          <p className="px-6 py-8 text-sm font-medium text-zinc-400">No department attendance yet.</p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6">Headcount</th>
                  <th className="py-3.5 px-6">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deptPaging.pageItems.map((row) => (
                  <tr key={row.name} className="hover:bg-zinc-50/50">
                    <td className="py-3.5 px-6 font-semibold text-zinc-900">{row.name}</td>
                    <td className="py-3.5 px-6 text-zinc-500">{row.headcount}</td>
                    <td className="py-3.5 px-6 font-semibold">{row.attendancePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListPagination
              className="px-6 py-3 border-t border-border"
              page={deptPaging.page}
              totalPages={deptPaging.totalPages}
              total={deptPaging.total}
              pageItemCount={deptPaging.pageItems.length}
              onPageChange={deptPaging.setPage}
            />
          </>
        )}
      </div>

      <div className="border border-border rounded-2xl p-6 bg-surface flex flex-col gap-4">
        <h2 className="text-h3 font-semibold text-zinc-900">Insights</h2>
        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div
              className="size-16 rounded-2xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(to top, #18181B, #71717A)",
                boxShadow: "0 0 0 1px rgba(24,24,27,0.15)",
              }}
            >
              <AiIcon className="size-8 text-white" />
            </div>
            <p className="text-sm text-zinc-500 font-medium max-w-sm">
              {data.aiEnabled
                ? "Refresh insights to generate a written analysis of these metrics."
                : "Written analysis will appear here after an AI provider is connected."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {insightPaging.pageItems.map((insight) => (
                <div key={insight.id} className="border border-border rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={INSIGHT_BADGE[insight.severity]}>{insight.severity}</Badge>
                    <h3 className="text-sm font-semibold text-zinc-900">{insight.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-600 font-medium">{insight.body}</p>
                  {insight.href ? (
                    <Link href={insight.href} className="text-sm font-semibold text-zinc-900 hover:underline">
                      {insight.action}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-zinc-900">{insight.action}</p>
                  )}
                </div>
              ))}
            </div>
            <ListPagination
              page={insightPaging.page}
              totalPages={insightPaging.totalPages}
              total={insightPaging.total}
              pageItemCount={insightPaging.pageItems.length}
              onPageChange={insightPaging.setPage}
            />
          </>
        )}
      </div>

      {data.flightRisk.length > 0 ? (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-h3 font-semibold text-zinc-900">Flight-risk indicators</h2>
            <p className="text-sm text-zinc-500 font-medium">Operational signals only — not a prediction that someone will resign.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3.5 px-6">Employee</th>
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6">Score</th>
                  <th className="py-3.5 px-6">Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flightPaging.pageItems.map((row) => (
                  <tr key={row.employeeId} className="hover:bg-zinc-50/50">
                    <td className="py-3.5 px-6">
                      <p className="font-semibold text-zinc-900">{row.name}</p>
                      <p className="text-xs text-zinc-400">{row.employeeId}</p>
                    </td>
                    <td className="py-3.5 px-6 text-zinc-500">{row.department}</td>
                    <td className="py-3.5 px-6 font-semibold">{row.score}</td>
                    <td className="py-3.5 px-6 text-zinc-500">{row.reasons.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            className="px-6 py-3 border-t border-border"
            page={flightPaging.page}
            totalPages={flightPaging.totalPages}
            total={flightPaging.total}
            pageItemCount={flightPaging.pageItems.length}
            onPageChange={flightPaging.setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
