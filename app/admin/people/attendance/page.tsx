import { AttendanceClient } from "./attendance-client";
import { listAttendanceLogs } from "@/lib/actions/attendance";

export default async function AttendancePage() {
  const result = await listAttendanceLogs();
  return <AttendanceClient initialLogs={result.ok ? result.data : []} />;
}
