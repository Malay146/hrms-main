import { listAllocations } from "@/lib/actions/people/allocations";
import { listTimeOffTypes } from "@/lib/actions/people/time-off-types";
import { prisma } from "@/lib/db";
import { AllocationsClient } from "./allocations-client";

export default async function LeaveAllocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const params = await searchParams;
  const employeeCode = params.employeeId?.trim() || null;
  const [allocations, types, employees] = await Promise.all([
    listAllocations({ employeeCode }),
    listTimeOffTypes(),
    prisma.employeeProfile.findMany({
      select: { id: true, employeeId: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <AllocationsClient
      initialAllocations={allocations.ok ? allocations.data : []}
      types={types.ok ? types.data : []}
      employees={employees.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        name: row.fullName,
      }))}
      filterEmployeeCode={employeeCode}
    />
  );
}
