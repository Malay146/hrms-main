import { EmployeeDashboardClient } from "./employee-dashboard-client";
import { getEmployeeDashboard } from "@/lib/actions/dashboard";

const empty = {
  firstName: "there",
  greeting: "Good morning",
  todayLabel: "",
  isClockedIn: false,
  checkInLabel: "",
  workedHours: "0.0 hrs",
  remainingLeave: 0,
  upcomingLabel: "No upcoming leave",
  latestRating: null,
  weeklyHours: [],
};

export default async function EmployeePage() {
  const result = await getEmployeeDashboard();
  return <EmployeeDashboardClient initial={result.ok ? result.data : empty} />;
}
