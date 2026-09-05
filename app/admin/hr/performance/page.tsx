import { getPerformanceBoard } from "@/lib/actions/performance";
import { PerformanceClient } from "./performance-client";

export default async function PerformancePage() {
  const result = await getPerformanceBoard();
  if (!result.ok) {
    return (
      <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface">
        <h1 className="text-h1 font-medium">Performance</h1>
        <p className="text-body-lg text-zinc-500 font-medium mt-2">{result.error}</p>
      </div>
    );
  }
  return <PerformanceClient initial={result.data} />;
}
