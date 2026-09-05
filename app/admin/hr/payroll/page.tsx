import { listPayruns } from "@/lib/actions/payruns";
import { listSalaryStructures } from "@/lib/actions/salary";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
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
