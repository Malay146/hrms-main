import { LeaveClient } from "./leave-client";
import { listLeaveRequests } from "@/lib/actions/people/leave";

export default async function LeavePage() {
  const result = await listLeaveRequests();
  return <LeaveClient initialRequests={result.ok ? result.data : []} />;
}
