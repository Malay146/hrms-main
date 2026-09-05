import { listAttendanceLogs } from "@/lib/actions/people/attendance";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    employeeId?: string;
    q?: string;
    status?: string;
    page?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const result = await listAttendanceLogs({
    employeeCode: params.employeeId?.trim() || null,
    search: params.q,
    status: params.status,
    page: Number(params.page || "1"),
    pageSize: 20,
    from: params.from,
    to: params.to,
  });

  const empty = {
    logs: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    from: "",
    to: "",
    stats: { present: 0, late: 0, leave: 0, absent: 0 },
  };

  return (
    <AttendanceClient
      initial={result.ok ? result.data : empty}
      filterEmployeeCode={params.employeeId?.trim() || null}
      query={{
        q: params.q ?? "",
        status: params.status ?? "All",
        page: result.ok ? result.data.page : 1,
        from: result.ok ? result.data.from : (params.from ?? ""),
        to: result.ok ? result.data.to : (params.to ?? ""),
      }}
    />
  );
}
