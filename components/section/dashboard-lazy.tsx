"use client";

import dynamic from "next/dynamic";
import type { DashboardStats } from "@/lib/shared/types";
import type { PayrollDashboardData } from "@/lib/actions/payroll/payroll-dashboard";

const Dashboard = dynamic(() => import("@/components/section/dashboard"), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[480px] border border-border rounded-2xl p-6 bg-surface animate-pulse" />
  ),
});

export function DashboardLazy(props: {
  stats: DashboardStats;
  payroll?: PayrollDashboardData;
  filters: {
    periodStart: string;
    periodEnd: string;
    department: string;
    employeeType: string;
  };
}) {
  return <Dashboard {...props} />;
}
