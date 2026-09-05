"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import {
  issueMonthEndPayslipsAction,
  sendPayslipEmailAction,
  type PayslipListItem,
} from "@/lib/actions/payroll/payruns";
import { formatPayrollMonth, payslipIssueMonth } from "@/lib/shared/dates";
import { ListPagination, useClientPagination } from "@/components/ui/list-pagination";

export function PayslipsClient({
  rows,
  canEmail,
}: {
  rows: PayslipListItem[];
  canEmail: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const month = payslipIssueMonth();
  const monthLabel = formatPayrollMonth(month);
  const {
    page,
    setPage,
    totalPages,
    total,
    pageItems: pagedRows,
  } = useClientPagination(rows, 20);

  function issueMonth() {
    startTransition(async () => {
      const result = await issueMonthEndPayslipsAction(month);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Emailed ${result.data.sent} payslip${result.data.sent === 1 ? "" : "s"} for ${monthLabel}. Skipped ${result.data.skipped}. Failed ${result.data.failed}.`,
      );
      router.refresh();
    });
  }

  function emailOne(id: string) {
    startTransition(async () => {
      const result = await sendPayslipEmailAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payslip emailed to the employee.");
      router.refresh();
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Payslips</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Open a slip for the rule-level computation. At month end, email every employee their statement.
          </p>
        </div>
        {canEmail ? (
          <button
            type="button"
            disabled={pending}
            onClick={issueMonth}
            className="cursor-pointer rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2 inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Mail className="size-4" />
            {pending ? "Sending…" : `Email ${monthLabel} payslips`}
          </button>
        ) : null}
      </div>
      <div className="border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Employee</th>
              <th className="py-3.5 px-4">Period</th>
              <th className="py-3.5 px-4">Structure</th>
              <th className="py-3.5 px-4">Net</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No payslips yet
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 px-6">
                    <Link href={`/admin/hr/payroll/payslips/${row.id}`} className="font-semibold text-zinc-900">
                      {row.employeeName}
                    </Link>
                    <p className="text-xs text-zinc-400">{row.employeeCode}</p>
                  </td>
                  <td className="py-3 px-4">
                    {row.periodStart} — {row.periodEnd}
                  </td>
                  <td className="py-3 px-4">{row.structureName}</td>
                  <td className="py-3 px-4 font-semibold">₹{row.net.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4 capitalize">{row.status}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="text-xs font-semibold text-zinc-500">
                      {row.sentAt ? "Sent" : "Not sent"}
                    </span>
                    {canEmail ? (
                      <button
                        type="button"
                        disabled={pending || (row.status !== "validated" && row.status !== "paid")}
                        onClick={() => emailOne(row.id)}
                        className="cursor-pointer ml-2 px-2 py-1 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-surface-hover disabled:opacity-50"
                      >
                        Email
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <ListPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageItemCount={pagedRows.length}
        onPageChange={setPage}
      />
    </div>
  );
}
