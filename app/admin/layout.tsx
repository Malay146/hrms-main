import { AppChrome } from "@/components/layout/app-chrome";
import { requireStaffPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaffPage();
  return <AppChrome user={user}>{children}</AppChrome>;
}
