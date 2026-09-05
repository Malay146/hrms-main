import { listPayslips } from "@/lib/actions/payroll/payruns";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PayslipsClient } from "./payslips-client";

export default async function PayslipsPage() {
  const [result, user] = await Promise.all([listPayslips(), getCurrentUser()]);
  return (
    <PayslipsClient
      rows={result.ok ? result.data : []}
      canEmail={hasPermission(user?.role, "editPayroll")}
    />
  );
}
