import { EmployeesClient } from "./employees-client";
import { listEmployees, type EmployeeSortKey } from "@/lib/actions/people/employees";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseSort(value: string): EmployeeSortKey {
  switch (value) {
    case "department":
    case "designation":
    case "joined":
    case "status":
    case "employeeId":
    case "name":
      return value;
    default:
      return "name";
  }
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = first(params.view) === "list" ? "list" : "kanban";
  const page = Number(first(params.page) || "1");
  const search = first(params.q);
  const department = first(params.department) || "All";
  const status = first(params.status) || "All";
  const sort = parseSort(first(params.sort));
  const dir = first(params.dir) === "desc" ? "desc" : "asc";
  const pageSize = view === "kanban" ? 15 : 20;

  const result = await listEmployees({
    page,
    pageSize,
    search,
    department,
    status,
    sort,
    dir,
  });

  const empty = {
    employees: [],
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
    departments: [] as string[],
    sort,
    dir: dir as "asc" | "desc",
    stats: {
      total: 0,
      active: 0,
      onLeave: 0,
      inactive: 0,
      removedInactiveCount: 0,
    },
  };

  return (
    <EmployeesClient
      initial={result.ok ? result.data : empty}
      view={view}
      query={{
        q: search,
        department,
        status,
        page: result.ok ? result.data.page : 1,
        sort: result.ok ? result.data.sort : sort,
        dir: result.ok ? result.data.dir : dir,
      }}
    />
  );
}
