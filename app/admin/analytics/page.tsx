import { getAiAnalytics } from "@/lib/actions/ai";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  const result = await getAiAnalytics();
  if (!result.ok) {
    return (
      <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface">
        <h1 className="text-h1 font-medium">AI Analytics</h1>
        <p className="text-body-lg text-zinc-500 font-medium mt-2">{result.error}</p>
      </div>
    );
  }
  return <AnalyticsClient data={result.data} />;
}
