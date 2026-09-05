import { getProfileAction } from "@/lib/actions/people/employees";
import { getCurrentUser } from "@/lib/auth/session";
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
