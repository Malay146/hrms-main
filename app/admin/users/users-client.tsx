"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateManagedUserAction, type ManagedUser } from "@/lib/actions/users";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/auth/permissions";
import type { Role } from "@/lib/shared/types";
import { useRouter } from "next/navigation";

export function UsersClient({ users }: { users: ManagedUser[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(user: ManagedUser, role: Role, status: "active" | "inactive") {
    startTransition(async () => {
      const result = await updateManagedUserAction({ userId: user.id, role, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Access updated");
      router.refresh();
    });
  }

  return (
    <div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-medium">User Management</h1>
        <p className="text-body-lg text-zinc-500 font-medium">
          Admin-only. Accounts stay linked to employee records. You cannot change your own role.
        </p>
      </div>
      <div className="border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-zinc-50/80 border-b text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-3.5 px-6">User</th>
              <th className="py-3.5 px-4">Employee</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="py-3 px-6">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-zinc-400">{user.email}</p>
                </td>
                <td className="py-3 px-4">{user.employeeName ?? "—"} {user.employeeId ? `(${user.employeeId})` : ""}</td>
                <td className="py-3 px-4">
                  <select
                    defaultValue={user.role}
                    className="h-10 px-2 border border-border rounded-lg text-sm"
                    id={`role-${user.id}`}
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-4">
                  <select defaultValue={user.status === "inactive" ? "inactive" : "active"} className="h-10 px-2 border border-border rounded-lg text-sm" id={`status-${user.id}`}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const role = (document.getElementById(`role-${user.id}`) as HTMLSelectElement).value as Role;
                      const status = (document.getElementById(`status-${user.id}`) as HTMLSelectElement).value as "active" | "inactive";
                      save(user, role, status);
                    }}
                    className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-3 py-2"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
