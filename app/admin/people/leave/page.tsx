import { LeaveClient } from "./leave-client";
import { listLeaveRequests } from "@/lib/actions/people/leave";

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const result = await listLeaveRequests({
    page: Number(params.page || "1"),
    pageSize: 20,
    search: params.q,
    status: params.status,
  });

  const empty = { rows: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };

  return (
    <LeaveClient
      initial={result.ok ? result.data : empty}
      query={{
        q: params.q ?? "",
        status: params.status ?? "All",
        page: result.ok ? result.data.page : 1,
      }}
    />
  );
}
