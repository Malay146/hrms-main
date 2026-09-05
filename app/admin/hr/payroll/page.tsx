import { PayrollClient } from "./payroll-client";
import { listPayroll } from "@/lib/actions/payroll";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

export default async function PayrollPage() {
  const [result, user] = await Promise.all([listPayroll(), getCurrentUser()]);
  return (
    <PayrollClient
      initialRows={result.ok ? result.data : []}
      canEdit={hasPermission(user?.role, "editPayroll")}
    />
  );
}
