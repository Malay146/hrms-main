import { PayrollClient } from "./payroll-client";
import { listPayroll } from "@/lib/actions/payroll";

export default async function PayrollPage() {
  const result = await listPayroll();
  return <PayrollClient initialRows={result.ok ? result.data : []} />;
}
