export type ContractWindow = {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  status: "running" | "expired";
};

export function windowsOverlap(a: ContractWindow, b: ContractWindow) {
  const aEnd = a.endDate ?? "9999-12-31";
  const bEnd = b.endDate ?? "9999-12-31";
  return a.startDate <= bEnd && b.startDate <= aEnd;
}

export function assertSingleRunning(next: ContractWindow, existing: ContractWindow[]) {
  if (next.status !== "running") return null;
  const clash = existing.find(
    (row) => row.id !== next.id && row.status === "running" && windowsOverlap(next, row),
  );
  return clash
    ? "An employee cannot have two Running contracts in the same period."
    : null;
}

export function contractForPeriod(
  contracts: ContractWindow[],
  periodStart: string,
  periodEnd: string,
) {
  const covering = contracts.filter((row) => {
    const end = row.endDate ?? "9999-12-31";
    return row.startDate <= periodEnd && end >= periodStart;
  });
  return covering.find((row) => row.status === "running") ?? covering[0] ?? null;
}
