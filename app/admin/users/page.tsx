import { listManagedUsers } from "@/lib/actions/users";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const result = await listManagedUsers();
  return <UsersClient users={result.ok ? result.data : []} />;
}
