import { getPayslip } from "@/lib/actions/payroll/payruns";

export default async function PayslipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPayslip(id);
  if (!result.ok) {
    return <p>{result.error}</p>;
  }
  const slip = result.data;
  return (
    <div className="min-h-screen bg-white text-zinc-950 p-10 print:p-0">
      <style>{`@media print { nav, aside, button { display: none !important; } }`}</style>
      <div className="max-w-2xl mx-auto border border-zinc-200 rounded-xl p-8">
        <h1 className="text-2xl font-semibold">Payslip</h1>
        <p className="text-sm text-zinc-500 mt-1">PeoplePay360 / Oddo</p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <p><span className="text-zinc-500">Employee</span><br />{slip.employeeName} ({slip.employeeCode})</p>
          <p><span className="text-zinc-500">Period</span><br />{slip.periodStart} — {slip.periodEnd}</p>
          <p><span className="text-zinc-500">Structure</span><br />{slip.structureName}</p>
          <p><span className="text-zinc-500">Worked days</span><br />{slip.workedDays}</p>
        </div>
        <table className="w-full text-left text-sm mt-8">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider text-zinc-500">
              <th className="py-2">Component</th>
              <th className="py-2">Code</th>
              <th className="py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {slip.lines.map((line) => (
              <tr key={line.code} className="border-b border-zinc-100">
                <td className="py-2">{line.name}</td>
                <td className="py-2">{line.code}</td>
                <td className="py-2">₹{line.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-lg font-semibold">Net salary: ₹{slip.net.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}
