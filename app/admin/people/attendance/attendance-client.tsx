"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import PresentTodayIcon from "@/components/icons/present-today";
import LeaveTodayIcon from "@/components/icons/leave-today";
import LateIcon from "@/components/icons/late";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import {
  listAttendanceEmployees,
  upsertAttendanceAction,
} from "@/lib/actions/people/attendance";
import type { AttendanceLogItem, AttendanceStatus } from "@/lib/shared/types";
import { ListPagination, useClientPagination } from "@/components/ui/list-pagination";

const inputClass =
  "h-10 px-3 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-border-strong";

export function AttendanceClient({
  initialLogs,
  filterEmployeeCode,
}: {
  initialLogs: AttendanceLogItem[];
  filterEmployeeCode?: string | null;
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [employees, setEmployees] = useState<
    { userId: string; employeeId: string; name: string }[]
  >([]);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      logs.filter((log) => {
        const matchesSearch =
          log.name.toLowerCase().includes(search.toLowerCase()) ||
          log.email.toLowerCase().includes(search.toLowerCase()) ||
          (log.employeeCode ?? "").toLowerCase().includes(search.toLowerCase());
        const matchesStatus = status === "All" || log.status === status;
        return matchesSearch && matchesStatus;
      }),
    [logs, search, status],
  );

  const {
    page,
    setPage,
    totalPages,
    total,
    pageItems: pagedLogs,
  } = useClientPagination(filtered, 20, `${search}|${status}`);

  const present = logs.filter((log) => log.status === "Present" || log.status === "Late").length;
  const late = logs.filter((log) => log.late).length;
  const leave = logs.filter((log) => log.status === "Leave").length;
  const absent = logs.filter((log) => log.status === "Absent").length;
  const statuses = useMemo(
    () => ["All", ...new Set(logs.map((log) => log.status))],
    [logs],
  );

  async function openCreate() {
    const result = await listAttendanceEmployees();
    if (result.ok) setEmployees(result.data);
    setShowCreate(true);
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await upsertAttendanceAction({
        userId: String(form.get("userId") ?? ""),
        date: String(form.get("date") ?? ""),
        checkIn: String(form.get("checkIn") ?? "") || null,
        checkOut: String(form.get("checkOut") ?? "") || null,
        status: String(form.get("status") ?? "present") as AttendanceStatus,
        notes: String(form.get("notes") ?? "") || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLogs((prev) => [result.data, ...prev.filter((row) => row.id !== result.data.id)]);
      setShowCreate(false);
      toast.success("Attendance saved.");
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium">Attendance</h1>
          <p className="text-body-lg text-zinc-500 font-medium">
            Daily check-in log with worked hours and manual corrections.
          </p>
          {filterEmployeeCode ? (
            <p className="text-xs font-semibold text-zinc-500 mt-1">
              Filtered to{" "}
              <Link
                href={`/admin/people/employees/${filterEmployeeCode}`}
                className="underline text-zinc-900"
              >
                {filterEmployeeCode}
              </Link>
              {" · "}
              <Link href="/admin/people/attendance" className="underline text-zinc-600">
                Clear
              </Link>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98"
        >
          <Plus className="size-4" />
          Correct / add
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Present", value: present, icon: PresentTodayIcon },
          { label: "Late arrivals", value: late, icon: LateIcon },
          { label: "On leave", value: leave, icon: LeaveTodayIcon },
          { label: "Absent", value: absent, icon: LateIcon },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-border rounded-xl p-5 bg-surface">
              <div
                className="size-12 rounded-lg flex items-center justify-center text-white"
                style={{ background: "linear-gradient(to top, #18181B, #71717A)" }}
              >
                <Icon className="size-[30px]" />
              </div>
              <p className="text-2xl font-bold text-zinc-950 mt-4">{stat.value}</p>
              <p className="text-sm font-medium text-zinc-500 mt-2">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-3">
          <Search className="size-4 absolute left-3 top-3 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee"
            className="h-10 w-full pl-9 border border-border rounded-lg text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 px-3 border border-border rounded-lg text-sm"
        >
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">Employee</th>
              <th className="py-3.5 px-6">Date</th>
              <th className="py-3.5 px-6">Check In</th>
              <th className="py-3.5 px-6">Check Out</th>
              <th className="py-3.5 px-6">Worked</th>
              <th className="py-3.5 px-6">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm font-medium text-zinc-400">
                  No attendance logs found
                </td>
              </tr>
            ) : (
              pagedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50">
                  <td className="py-3.5 px-6">
                    <Link
                      href={`/admin/people/attendance/${log.id}`}
                      className="flex items-center gap-3"
                    >
                      <PersonAvatar name={log.name} size={32} />
                      <div>
                        <p className="font-semibold text-zinc-900">{log.name}</p>
                        <p className="text-xs text-zinc-400">{log.department}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="py-3.5 px-6">{log.date}</td>
                  <td className="py-3.5 px-6">{log.checkIn}</td>
                  <td className="py-3.5 px-6">{log.checkOut}</td>
                  <td className="py-3.5 px-6 text-zinc-500">
                    {log.workingHours}
                    {log.manualEdit ? (
                      <span className="ml-1 text-[10px] font-bold text-zinc-400">EDIT</span>
                    ) : null}
                  </td>
                  <td className="py-3.5 px-6">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                        log.status === "Present" &&
                          "bg-emerald-50 text-emerald-700 border-emerald-200/50",
                        log.status === "Late" &&
                          "bg-amber-50 text-amber-700 border-amber-200/50",
                        log.status === "Half Day" &&
                          "bg-amber-50 text-amber-700 border-amber-200/50",
                        log.status === "Leave" &&
                          "bg-amber-50 text-amber-700 border-amber-200/50",
                        log.status === "Absent" &&
                          "bg-red-50 text-red-700 border-red-200/50",
                      )}
                    >
                      {log.status}
                    </span>
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
        pageItemCount={pagedLogs.length}
        onPageChange={setPage}
      />

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Correct attendance"
        description="Sets manualEdit and recomputes worked hours."
        className="max-w-lg"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-3 text-left">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-500">Employee</span>
            <select name="userId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Select
              </option>
              {employees.map((emp) => (
                <option key={emp.userId} value={emp.userId}>
                  {emp.name} ({emp.employeeId})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-500">Date</span>
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-zinc-500">Check in</span>
              <input name="checkIn" type="time" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-zinc-500">Check out</span>
              <input name="checkOut" type="time" className={inputClass} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-500">Status</span>
            <select name="status" defaultValue="present" className={inputClass}>
              <option value="present">Present</option>
              <option value="half_day">Half day</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-500">Notes</span>
            <input name="notes" className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer h-10 rounded-lg bg-zinc-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
