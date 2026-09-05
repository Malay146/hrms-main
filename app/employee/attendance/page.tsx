import { listMyAttendance } from "@/lib/actions/attendance";
import { cn } from "@/utils/cn";

export default async function EmployeeAttendancePage() {
  const result = await listMyAttendance();
  const logs = result.ok ? result.data : [];
  const lateCount = logs.filter((log) => log.late).length;
  const onTimeRate = logs.length === 0 ? "0%" : `${Math.round(((logs.length - lateCount) / logs.length) * 100)}%`;

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">My Attendance Logs</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Review your historical shift logs, work hours, and arrival stats.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Logged days", value: String(logs.length) },
          { label: "Late arrivals", value: String(lateCount) },
          { label: "On-Time Arrival Rate", value: onTimeRate },
        ].map((stat) => (
          <div key={stat.label} className="border border-border rounded-xl p-5 bg-surface">
            <span className="text-sm font-medium text-zinc-500">{stat.label}</span>
            <span className="text-2xl font-bold text-zinc-950 mt-2 block">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/85 border-b text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <th className="py-3 px-6">Work Date</th>
              <th className="py-3 px-6">Check In</th>
              <th className="py-3 px-6">Check Out</th>
              <th className="py-3 px-6">Working Hours</th>
              <th className="py-3 px-6">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No attendance logs yet
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/30">
                  <td className="py-3.5 px-6 font-bold text-zinc-950">{log.date}</td>
                  <td className="py-3.5 px-6">{log.checkIn}</td>
                  <td className="py-3.5 px-6">{log.checkOut}</td>
                  <td className="py-3.5 px-6 text-zinc-500">{log.workingHours}</td>
                  <td className="py-3.5 px-6">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border",
                      log.status === "Present" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                      log.status === "Late" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      log.status === "Half Day" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      log.status === "Leave" && "bg-amber-50 text-amber-700 border-amber-200/50",
                      log.status === "Absent" && "bg-red-50 text-red-700 border-red-200/50",
                    )}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
