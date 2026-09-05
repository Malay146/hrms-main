import { getContractFormOptions, listContracts } from "@/lib/actions/contracts";
import { ContractsClient } from "./contracts-client";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const params = await searchParams;
  const employeeCode = params.employeeId?.trim() || null;
  const [contracts, options] = await Promise.all([
    listContracts({ employeeCode }),
    getContractFormOptions(),
  ]);

  return (
    <ContractsClient
      initialContracts={contracts.ok ? contracts.data : []}
      options={
        options.ok
          ? options.data
          : { employees: [], departments: [], schedules: [], salaryStructures: [] }
      }
      filterEmployeeCode={employeeCode}
    />
  );
}
