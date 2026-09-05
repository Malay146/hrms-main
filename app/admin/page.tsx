import Dashboard from "@/components/section/dashboard";
import { getAdminDashboard } from "@/lib/actions/dashboard";

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

export default async function AdminPage() {
  const result = await getAdminDashboard();
  return <Dashboard stats={result.ok ? result.data : emptyStats} />;
}
