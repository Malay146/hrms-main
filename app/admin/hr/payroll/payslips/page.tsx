import { listPayslips } from "@/lib/actions/payruns";
import Link from "next/link";

export default async function PayslipsPage() {
  const result = await listPayslips();
  const rows = result.ok ? result.data : [];
  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">Payslips</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Open a slip for the rule-level computation and print action.
        </p>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No payslips yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
