import { AppChrome } from "@/components/layout/app-chrome";
import { requirePageRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageRole("admin");
  return <AppChrome user={user}>{children}</AppChrome>;
}
