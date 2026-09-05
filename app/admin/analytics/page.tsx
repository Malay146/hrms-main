"use client";

import AiIcon from "@/components/icons/sidebar/ai";

export default function AnalyticsPage() {
  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col text-left">
        <h1 className="type-title">AI Analytics</h1>
        <p className="type-subtitle">
          Intelligent insights and predictive analytics powered by AI.
        </p>
      </div>

      {/* Empty State */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div
          className="size-16 rounded-2xl flex items-center justify-center text-white"
          style={{
            background: "linear-gradient(to top, #18181B, #71717A)",
            boxShadow: "0 0 0 1px rgba(24,24,27,0.15)",
          }}
        >
          <AiIcon className="size-8 text-white" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-h3 font-semibold text-zinc-900">AI Analytics</h2>
          <p className="text-sm text-zinc-500 font-medium max-w-sm">
            This section is coming soon. AI-powered workforce insights,
            attrition prediction, and hiring intelligence will be available
            here.
          </p>
        </div>
        <span className="mt-2 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
