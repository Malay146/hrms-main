import { Receipt } from "lucide-react";

export default function PayslipsPage() {
  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 font-medium">Payslips</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Individual payslips generated from payruns.
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center border border-dashed border-border rounded-xl">
        <Receipt className="size-8 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-500">No payslips yet.</p>
        <p className="text-xs text-zinc-400 max-w-sm">
          Krishil owns payslip UI on the payroll track.
        </p>
      </div>
    </div>
  );
}
