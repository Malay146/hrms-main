import Link from "next/link";
import { getPayslip } from "@/lib/actions/payruns";

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getPayslip(id);
  if (!result.ok) {
    return (
      <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface">
        <h1 className="text-h1 font-medium">Payslip not found</h1>
        <p className="text-body-lg text-zinc-500 font-medium">{result.error}</p>
      </div>
    );
  }
  const slip = result.data;
  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">
            {slip.employeeName} / {slip.periodStart}
          </h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            {slip.structureName} · {slip.payrunName} · {slip.workedDays} worked days · {slip.status}
          </p>
        </div>
        <Link
          href={`/admin/hr/payroll/payslips/${slip.id}/print`}
          className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3.5 py-2"
        >
          Print payslip
        </Link>
      </div>
      {slip.warning ? (
        <p className="text-sm font-semibold text-amber-700 border border-amber-200 rounded-lg px-3 py-2">
          {slip.warning}
        </p>
      ) : null}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Rule</th>
              <th className="py-3.5 px-4">Code</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slip.lines.map((line) => (
              <tr key={line.code}>
                <td className="py-3 px-6 font-medium">{line.name}</td>
                <td className="py-3 px-4">{line.code}</td>
                <td className="py-3 px-4 capitalize">{line.category}</td>
                <td className="py-3 px-4">
                  {line.category === "deduction" || line.category === "contribution" ? "-" : ""}
                  ₹{Math.abs(line.amount).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
