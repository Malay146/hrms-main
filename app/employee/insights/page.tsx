import { WorkforceWorkspace } from "@/components/analytics/workforce-workspace";
import { getWorkforceDashboard } from "@/lib/actions/workforce-insights";

export const dynamic = "force-dynamic";

export default async function EmployeeInsightsPage() {
  const result = await getWorkforceDashboard();
  if (!result.ok) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-2xl font-semibold text-text-primary">My career & insights</h1>
        <p className="mt-2 text-sm text-text-secondary">{result.error}</p>
      </div>
    );
  }
  return <WorkforceWorkspace data={result.data} />;
}
