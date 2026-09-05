import { listDepartments } from "@/lib/actions/people/departments";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const result = await listDepartments();
  return <DepartmentsClient initialDepartments={result.ok ? result.data : []} />;
}
