import { EmployeeAttendanceClient } from "./attendance-client";
import { listMyAttendance } from "@/lib/actions/people/attendance";
import { getEmployeeDashboard } from "@/lib/actions/dashboard";

export default async function EmployeeAttendancePage() {
  const [logsResult, dashResult] = await Promise.all([listMyAttendance(), getEmployeeDashboard()]);
  const logs = logsResult.ok ? logsResult.data : [];
  const clock = dashResult.ok
    ? {
        isClockedIn: dashResult.data.isClockedIn,
        checkInLabel: dashResult.data.checkInLabel,
        checkInAt: dashResult.data.checkInAt,
        workedHours: dashResult.data.workedHours,
      }
    : {
        isClockedIn: false,
        checkInLabel: "",
        checkInAt: null,
        workedHours: "0.0 hrs",
      };

  return <EmployeeAttendanceClient initialLogs={logs} initialClock={clock} />;
}
