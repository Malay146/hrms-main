import { EmployeeLeaveClient } from "./leave-client";
import {
  getLeaveCalendarMarkers,
  getPaidLeaveBalance,
  listMyLeaveFormOptions,
  listMyLeaves,
} from "@/lib/actions/leave";

export default async function EmployeeLeavePage() {
  const [requests, markers, balances, options] = await Promise.all([
    listMyLeaves(),
    getLeaveCalendarMarkers(),
    getPaidLeaveBalance(),
    listMyLeaveFormOptions(),
  ]);

  return (
    <EmployeeLeaveClient
      initialRequests={requests.ok ? requests.data : []}
      markers={markers.ok ? markers.data : []}
      balances={balances}
      options={
        options.ok
          ? options.data
          : { types: [], allocations: [] }
      }
    />
  );
}
