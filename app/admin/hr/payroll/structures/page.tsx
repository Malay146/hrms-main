import { getSalaryStructure, listSalaryStructures } from "@/lib/actions/salary";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { StructuresClient } from "./structures-client";

export default async function SalaryStructuresPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const [{ id }, user, list] = await Promise.all([
    searchParams,
    getCurrentUser(),
    listSalaryStructures(),
  ]);
  const selected = id ? await getSalaryStructure(id) : null;
  return (
    <StructuresClient
      structures={list.ok ? list.data : []}
      selected={selected?.ok ? selected.data : null}
      canEdit={hasPermission(user?.role, "manageSalaryConfig")}
    />
  );
}
