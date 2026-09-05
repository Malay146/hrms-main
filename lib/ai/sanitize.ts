import type { InternalSnapshot, ModelSnapshot } from "./snapshot";

/** Drop names, wages, and bank details before any model call. */
export function toModelSnapshot(input: InternalSnapshot): ModelSnapshot {
  return {
    health: input.health,
    attendancePct: input.attendancePct,
    departments: input.departments,
    leave: input.leave,
    payroll: input.payroll
      ? { net: input.payroll.net, warningPct: input.payroll.warningPct }
      : undefined,
    performance: input.performance,
    flightRisk: input.employees.map((employee) => ({
      department: employee.department,
      flightRisk: employee.flightRisk,
      tenureDays: employee.tenureDays ?? 0,
    })),
  };
}
