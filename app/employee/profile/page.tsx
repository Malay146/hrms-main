import { Mail, Phone, Calendar as CalendarIcon, ShieldCheck } from "lucide-react";
import { getProfileAction } from "@/lib/actions/employees";
import { getCurrentUser } from "@/lib/session";
import { PersonAvatar } from "@/components/ui/person-avatar";

export default async function EmployeeProfilePage() {
  const [user, result] = await Promise.all([getCurrentUser(), getProfileAction()]);
  const profile = result.ok ? result.data : null;
  const displayName = profile?.name ?? user?.fullName ?? "Employee";

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6 text-left">
      <div className="flex flex-col">
        <h1 className="type-title">My Profile</h1>
        <p className="type-subtitle">
          View your registered personal details and employment files.
        </p>
      </div>

      <div className="border border-border rounded-xl p-6 bg-surface flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <PersonAvatar name={displayName} size={80} />
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-950 leading-tight">
              {displayName}
            </h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full text-[10px] font-bold self-start">
              {profile?.status ?? "Active"}
            </span>
          </div>
          <p className="text-sm font-semibold text-zinc-500">
            {profile?.designation ?? user?.jobTitle} • {profile?.department ?? user?.department}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-semibold text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {profile?.email ?? user?.email}
            </span>
            {profile?.phone ? (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {profile.phone}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" />
              Joined {profile?.joinDate}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl p-5 bg-surface flex flex-col gap-4">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <ShieldCheck className="size-4 text-zinc-400" />
          Employment Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-zinc-500">
          <div className="flex flex-col gap-1">
            <span>Employee ID</span>
            <span className="text-zinc-900 font-bold text-sm">{profile?.employeeId ?? user?.employeeId ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span>Department</span>
            <span className="text-zinc-900 font-bold text-sm">{profile?.department ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span>Employment Type</span>
            <span className="text-zinc-900 font-bold text-sm">{profile?.type ?? "Full-time"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
