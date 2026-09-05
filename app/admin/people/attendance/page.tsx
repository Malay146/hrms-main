import Link from "next/link";
import { listAttendanceLogs } from "@/lib/actions/attendance";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const params = await searchParams;
  const employeeCode = params.employeeId?.trim() || null;
  const result = await listAttendanceLogs({ employeeCode });
  return (
    <AttendanceClient
      initialLogs={result.ok ? result.data : []}
      filterEmployeeCode={employeeCode}
    />
  );
}
