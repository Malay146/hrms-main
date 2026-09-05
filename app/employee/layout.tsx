import { AppChrome } from "@/components/layout/app-chrome";
import { requirePageRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageRole("employee");
  return <AppChrome user={user}>{children}</AppChrome>;
}
