import { Tags } from "lucide-react";

export default function LeaveTypesPage() {
  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-medium">Time Off Types</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Paid, sick, unpaid, and other leave categories.
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center border border-dashed border-border rounded-xl">
        <Tags className="size-8 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-500">Types are seeded.</p>
        <p className="text-xs text-zinc-400 max-w-sm">
          Type management UI lands with Time Off in Phase 4.
        </p>
      </div>
    </div>
  );
}
