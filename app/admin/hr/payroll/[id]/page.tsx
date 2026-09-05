import { getPayrun } from "@/lib/actions/payroll/payruns";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PayrunForm } from "./payrun-form";

export default async function PayrunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, user] = await Promise.all([getPayrun(id), getCurrentUser()]);
  if (!result.ok) {
    return (
      <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface">
        <h1 className="text-h1 font-medium">Payrun not found</h1>
        <p className="text-body-lg text-zinc-500 font-medium">{result.error}</p>
      </div>
    );
  }
  return (
    <PayrunForm
      payrun={result.data}
      canEdit={hasPermission(user?.role, "editPayroll")}
      canFinalize={hasPermission(user?.role, "finalizePayroll")}
    />
  );
}
