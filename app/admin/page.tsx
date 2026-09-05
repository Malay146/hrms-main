import Dashboard from "@/components/section/dashboard";
import { getAdminDashboard } from "@/lib/actions/dashboard";
import { getPayrollDashboard } from "@/lib/actions/payroll/payroll-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { kolkataTodayKey } from "@/lib/shared/dates";

const emptyStats = {
  firstName: "Admin",
  todayLabel: "",
  totalEmployees: 0,
  presentToday: 0,
  leaveToday: 0,
  pendingApprovals: 0,
  weeklyAttendance: [],
  recentLeaves: [],
  distribution: [],
  activities: [],
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; department?: string; type?: string }>;
}) {
  const params = await searchParams;
  const today = kolkataTodayKey();
  const periodStart = params.from ?? `${today.slice(0, 8)}01`;
  const periodEnd = params.to ?? today;
  const user = await getCurrentUser();
  const [result, payroll] = await Promise.all([
    getAdminDashboard(),
    user
      ? getPayrollDashboard({
          user,
          periodStart,
          periodEnd,
          department: params.department || undefined,
          employeeType: (params.type as "full_time" | "intern" | "contractor" | undefined) || undefined,
        })
      : Promise.resolve({ ok: false as const, error: "Not signed in" }),
  ]);
  return (
    <Dashboard
      stats={result.ok ? result.data : emptyStats}
      payroll={payroll.ok ? payroll.data : undefined}
      filters={{
        periodStart,
        periodEnd,
        department: params.department ?? "",
        employeeType: params.type ?? "",
      }}
    />
  );
}
