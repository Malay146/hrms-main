import { listSchedules } from "@/lib/actions/people/schedules";
import { SchedulesClient } from "./schedules-client";

export default async function SchedulesPage() {
  const result = await listSchedules();
  return <SchedulesClient initialSchedules={result.ok ? result.data : []} />;
}
