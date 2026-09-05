import { listMyPayslips } from "@/lib/actions/payroll/payruns";

export default async function EmployeePayrollPage() {
  const result = await listMyPayslips();
  const rows = result.ok ? result.data : [];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">My Payroll</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Validated and paid payslips only. Ask HR if a period looks wrong.
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Period</th>
              <th className="py-3.5 px-6">Structure</th>
              <th className="py-3.5 px-6">Gross</th>
              <th className="py-3.5 px-6">Net pay</th>
              <th className="py-3.5 px-6">Status</th>
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
                <tr key={row.id} className="hover:bg-zinc-50/50">
                  <td className="py-3.5 px-6 font-semibold text-zinc-900">
                    {row.periodStart} — {row.periodEnd}
                  </td>
                  <td className="py-3.5 px-6">{row.structureName}</td>
                  <td className="py-3.5 px-6">₹{row.gross.toLocaleString("en-IN")}</td>
                  <td className="py-3.5 px-6 font-bold text-zinc-950">₹{row.net.toLocaleString("en-IN")}</td>
                  <td className="py-3.5 px-6 capitalize">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
