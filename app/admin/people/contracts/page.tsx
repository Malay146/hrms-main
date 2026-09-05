import { getContractFormOptions, listContracts } from "@/lib/actions/people/contracts";
import { ContractsClient } from "./contracts-client";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    employeeId?: string;
    q?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const employeeCode = params.employeeId?.trim() || null;
  const statusRaw = params.status?.trim();
  const status =
    statusRaw === "running" || statusRaw === "expired" ? statusRaw : ("All" as const);

  const [contracts, options] = await Promise.all([
    listContracts({
      employeeCode,
      search: params.q,
      status,
      page: Number(params.page || "1"),
      pageSize: 20,
    }),
    getContractFormOptions({ employeeCode }),
  ]);

  const empty = {
    rows: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    stats: { total: 0, running: 0, expired: 0, endingSoon: 0, wageMonthly: 0 },
  };

  return (
    <ContractsClient
      initial={contracts.ok ? contracts.data : empty}
      options={
        options.ok
          ? options.data
          : { employees: [], departments: [], schedules: [], salaryStructures: [] }
      }
      filterEmployeeCode={employeeCode}
      query={{
        q: params.q ?? "",
        status,
        page: contracts.ok ? contracts.data.page : 1,
      }}
    />
  );
}
