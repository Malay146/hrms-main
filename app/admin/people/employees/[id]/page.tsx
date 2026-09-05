import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { getEmployeeByCode } from "@/lib/actions/employees";
import { cn } from "@/utils/cn";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEmployeeByCode(id);
  const employee = result.ok ? result.data : null;

  if (!employee) {
    return (
      <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-xl font-bold text-zinc-950">Employee Not Found</h2>
        <p className="text-zinc-500 max-w-sm font-medium">
          The employee ID you entered does not exist or has been removed.
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

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/people/employees"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 font-semibold"
        >
          <ArrowLeft className="size-4" />
          Back to Employees
        </Link>
      </div>

      <div className="border border-border rounded-xl p-6 bg-surface flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="size-20 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-2xl text-zinc-800 border border-zinc-200">
          {employee.avatar}
        </div>
        <div className="flex-1 flex flex-col gap-2 min-w-0 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <h1 className="text-h1 font-medium">{employee.name}</h1>
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold border w-fit",
                employee.status === "Active" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                employee.status === "On Leave" && "bg-amber-50 text-amber-700 border-amber-200/50",
                employee.status === "Inactive" && "bg-zinc-50 text-zinc-500 border-zinc-200",
              )}
            >
              {employee.status}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-500">
            {employee.designation} • {employee.department}
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-zinc-400 mt-2">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {employee.email}
            </span>
            {employee.phone ? (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {employee.phone}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-zinc-500">
        <div className="flex flex-col gap-1">
          <span>Employee ID</span>
          <span className="text-zinc-900 font-bold text-sm">{employee.employeeId}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span>Employment Type</span>
          <span className="text-zinc-900 font-bold text-sm">{employee.type}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span>Joined</span>
          <span className="text-zinc-900 font-bold text-sm">{employee.joinDate}</span>
        </div>
      </div>
    </div>
  );
}
