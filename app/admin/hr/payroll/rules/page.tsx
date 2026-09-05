import { listSalaryRules, listSalaryStructures } from "@/lib/actions/salary";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { RulesClient } from "./rules-client";

export default async function SalaryRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ structureId?: string; id?: string }>;
}) {
  const params = await searchParams;
  const [user, structures, rules] = await Promise.all([
    getCurrentUser(),
    listSalaryStructures(),
    listSalaryRules(params.structureId),
  ]);
  const selected = rules.ok ? rules.data.find((row) => row.id === params.id) ?? null : null;
  return (
    <RulesClient
      structures={structures.ok ? structures.data : []}
      rules={rules.ok ? rules.data : []}
      selected={selected}
      structureId={params.structureId ?? ""}
      canEdit={hasPermission(user?.role, "manageSalaryConfig")}
    />
  );
}
