import { getOrganizationSettings, listMySessions } from "@/lib/actions/settings";
import { requireStaffPage } from "@/lib/auth/session";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireStaffPage();
  const [organization, sessions] = await Promise.all([
    getOrganizationSettings(),
    listMySessions(),
  ]);

  return (
    <SettingsClient
      email={user.email}
      organization={organization.ok ? organization.data : null}
      organizationError={organization.ok ? null : organization.error}
      sessions={sessions.ok ? sessions.data : []}
    />
  );
}
