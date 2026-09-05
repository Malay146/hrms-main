import { getMyPayroll } from "@/lib/actions/payroll";

export default async function EmployeePayrollPage() {
  const result = await getMyPayroll();
  const rows = result.ok ? result.data : [];

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">My Payroll</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Read-only salary slips. Ask HR if a month looks wrong.
        </p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Month</th>
              <th className="py-3.5 px-6">Basic</th>
              <th className="py-3.5 px-6">HRA %</th>
              <th className="py-3.5 px-6">Allowance %</th>
              <th className="py-3.5 px-6">Deductions</th>
              <th className="py-3.5 px-6">Net pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No payroll records yet
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/50">
                  <td className="py-3.5 px-6 font-semibold text-zinc-900">{row.monthLabel}</td>
                  <td className="py-3.5 px-6">₹{row.basic.toLocaleString()}</td>
                  <td className="py-3.5 px-6">{row.hraPct}%</td>
                  <td className="py-3.5 px-6">{row.allowancePct}%</td>
                  <td className="py-3.5 px-6">₹{row.deductions.toLocaleString()}</td>
                  <td className="py-3.5 px-6 font-bold text-zinc-950">₹{row.netSalary.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
