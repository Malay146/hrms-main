import { getProfileAction } from "@/lib/actions/people/employees";
import { getCurrentUser } from "@/lib/auth/session";
import { EmployeeSettingsClient } from "./settings-client";

export default async function EmployeeSettingsPage() {
  const [user, result] = await Promise.all([
    getCurrentUser(),
    getProfileAction(),
  ]);

  return (
    <EmployeeSettingsClient
      profile={result.ok ? result.data : null}
      user={user}
    />
  );
}
