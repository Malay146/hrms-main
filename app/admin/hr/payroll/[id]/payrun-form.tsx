"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  computePayrunAction,
  markPayrunPaidAction,
  sendPayslipsAction,
  validatePayrunAction,
  type PayrunDetail,
} from "@/lib/actions/payroll/payruns";

export function PayrunForm({
  payrun,
  canEdit,
  canFinalize,
}: {
  payrun: PayrunDetail;
  canEdit: boolean;
  canFinalize: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function send() {
    startTransition(async () => {
      const result = await sendPayslipsAction(payrun.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Emailed ${result.data.sent}. Skipped ${result.data.skipped} already sent. Failed ${result.data.failed}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">{payrun.name}</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            {payrun.structureName} · {payrun.periodStart} — {payrun.periodEnd} · {payrun.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  async () => {
                    const result = await computePayrunAction(payrun.id);
                    if (!result.ok) return result;
                    return { ok: true as const };
                  },
                  "Payrun compute queued",
                )
              }
              className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
            >
              Compute
            </button>
          ) : null}
          {canFinalize ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => validatePayrunAction(payrun.id), "Payrun validated")}
                className="px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold"
              >
                Validate
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => markPayrunPaidAction(payrun.id), "Payrun marked paid")}
                className="px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold"
              >
                Mark paid
              </button>
            </>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              onClick={send}
              className="px-3.5 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold"
            >
              Email payslips
            </button>
          ) : null}
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-4">Employee</th>
              <th className="py-3.5 px-4">Worked</th>
              <th className="py-3.5 px-4">Basic</th>
              <th className="py-3.5 px-4">Gross</th>
              <th className="py-3.5 px-4">Net</th>
              <th className="py-3.5 px-4">Warning</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payrun.payslips.map((slip) => (
              <tr key={slip.id}>
                <td className="py-3 px-4">
                  <Link href={`/admin/hr/payroll/payslips/${slip.id}`} className="font-semibold text-zinc-900">
                    {slip.employeeName}
                  </Link>
                </td>
                <td className="py-3 px-4">{slip.workedDays}</td>
                <td className="py-3 px-4">₹{slip.basic.toLocaleString("en-IN")}</td>
                <td className="py-3 px-4">₹{slip.gross.toLocaleString("en-IN")}</td>
                <td className="py-3 px-4 font-semibold">₹{slip.net.toLocaleString("en-IN")}</td>
                <td className="py-3 px-4 text-amber-700">{slip.warning ?? "—"}</td>
                <td className="py-3 px-4 text-xs font-semibold text-zinc-500">
                  {slip.sentAt ? "Sent" : "Not sent"}
                </td>
                <td className="py-3 px-4">
                  <Link href={`/admin/hr/payroll/payslips/${slip.id}/print`} className="text-sm font-semibold">
                    Print
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
