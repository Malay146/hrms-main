import Link from "next/link";
import { getEmployeeHub } from "@/lib/actions/people/employees";
import { EmployeeForm } from "./employee-form";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEmployeeHub(id);

  if (!result.ok) {
    return (
      <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-xl font-bold text-zinc-950">Employee Not Found</h2>
        <p className="text-zinc-500 max-w-sm font-medium">
          {result.error || "The employee ID you entered does not exist or has been removed."}
        </p>
        <Link
          href="/admin/people/employees"
          className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-800"
        >
          Back to Employees List
        </Link>
      </div>
    );
  }

  return <EmployeeForm initial={result.data} />;
}
