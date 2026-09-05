import { listPayslips } from "@/lib/actions/payroll/payruns";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PayslipsClient } from "./payslips-client";

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page || "1");
  const [result, user] = await Promise.all([listPayslips({ page, pageSize: 20 }), getCurrentUser()]);
  const empty = { rows: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
  return (
    <PayslipsClient
      initial={result.ok ? result.data : empty}
      canEmail={hasPermission(user?.role, "editPayroll")}
    />
  );
}
