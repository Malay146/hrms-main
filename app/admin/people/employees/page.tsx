import { EmployeesClient } from "./employees-client";
import { listEmployees } from "@/lib/actions/people/employees";

export default async function EmployeesPage() {
  const result = await listEmployees();
  return <EmployeesClient initialEmployees={result.ok ? result.data : []} />;
}
