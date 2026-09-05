import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttendanceAction } from "@/lib/actions/people/attendance";
import { AttendanceDetailClient } from "./attendance-detail-client";

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getAttendanceAction(id);
  if (!result.ok) notFound();

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <Link
        href="/admin/people/attendance"
        className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 w-fit"
      >
        ← Back to Attendance
      </Link>
      <AttendanceDetailClient initial={result.data} />
    </div>
  );
}
