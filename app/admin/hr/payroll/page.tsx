import { listPayruns } from "@/lib/actions/payroll/payruns";
import { listSalaryStructures } from "@/lib/actions/payroll/salary";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PayrunListClient } from "./payrun-list-client";

export default async function PayrollPage() {
  const [payruns, structures, user] = await Promise.all([
    listPayruns(),
    listSalaryStructures(),
    getCurrentUser(),
  ]);
  return (
    <PayrunListClient
      payruns={payruns.ok ? payruns.data : []}
      structures={structures.ok ? structures.data : []}
      canEdit={hasPermission(user?.role, "editPayroll")}
    />
  );
}
