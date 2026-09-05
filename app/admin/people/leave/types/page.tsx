import { listTimeOffTypes } from "@/lib/actions/time-off-types";
import { TimeOffTypesClient } from "./types-client";

export default async function LeaveTypesPage() {
  const result = await listTimeOffTypes();
  return <TimeOffTypesClient initialTypes={result.ok ? result.data : []} />;
}
