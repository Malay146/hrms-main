import { getProfileAction } from "@/lib/actions/employees";
import { getCurrentUser } from "@/lib/session";
import { EmployeeProfileClient } from "./profile-client";

export default async function EmployeeProfilePage() {
  const [user, result] = await Promise.all([getCurrentUser(), getProfileAction()]);
  return (
    <EmployeeProfileClient
      profile={result.ok ? result.data : null}
      user={user}
    />
  );
}
