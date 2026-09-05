import { EmployeeDashboardClient } from "./employee-dashboard-client";
import { getEmployeeDashboard } from "@/lib/actions/dashboard";

const empty = {
  firstName: "there",
  todayLabel: "",
  isClockedIn: false,
  checkInLabel: "",
  workedHours: "0.0 hrs",
  remainingLeave: 0,
  weeklyHours: [],
};

export default async function EmployeePage() {
  const result = await getEmployeeDashboard();
  return <EmployeeDashboardClient initial={result.ok ? result.data : empty} />;
}
