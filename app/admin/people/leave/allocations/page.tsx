import { listAllocations } from "@/lib/actions/people/allocations";
import { listTimeOffTypes } from "@/lib/actions/people/time-off-types";
import { prisma } from "@/lib/db";
import { AllocationsClient } from "./allocations-client";

export default async function LeaveAllocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const employeeCode = params.employeeId?.trim() || null;
  const [allocations, types, employees, preset] = await Promise.all([
    listAllocations({
      employeeCode,
      page: Number(params.page || "1"),
      pageSize: 20,
    }),
    listTimeOffTypes(),
    prisma.employeeProfile.findMany({
      select: { id: true, employeeId: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 40,
    }),
    employeeCode
      ? prisma.employeeProfile.findFirst({
          where: { employeeId: employeeCode },
          select: { id: true, employeeId: true, fullName: true },
        })
      : Promise.resolve(null),
  ]);

  const employeeMap = new Map(
    employees.map((row) => [
      row.id,
      { id: row.id, employeeId: row.employeeId, name: row.fullName },
    ]),
  );
  if (preset) {
    employeeMap.set(preset.id, {
      id: preset.id,
      employeeId: preset.employeeId,
      name: preset.fullName,
    });
  }

  const empty = { rows: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };

  return (
    <AllocationsClient
      initial={allocations.ok ? allocations.data : empty}
      types={types.ok ? types.data : []}
      employees={[...employeeMap.values()].sort((a, b) => a.name.localeCompare(b.name))}
      filterEmployeeCode={employeeCode}
    />
  );
}
