import { EmployeeLeaveClient } from "./leave-client";
import { getLeaveCalendarMarkers, getPaidLeaveBalance, listMyLeaves } from "@/lib/actions/leave";

export default async function EmployeeLeavePage() {
  const [requests, markers, balances] = await Promise.all([
    listMyLeaves(),
    getLeaveCalendarMarkers(),
    getPaidLeaveBalance(),
  ]);

  return (
    <EmployeeLeaveClient
      initialRequests={requests.ok ? requests.data : []}
      markers={markers.ok ? markers.data : []}
      balances={balances}
    />
  );
}
