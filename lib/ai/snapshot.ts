import type { HealthBand } from "./metrics";

export type InternalEmployeeRow = {
  name: string;
  bankAccount?: string | null;
  wage?: number | null;
  flightRisk: number;
  department: string;
  tenureDays?: number;
};

export type InternalSnapshot = {
  health: { score: number; band: HealthBand | string; parts: { key: string; value: number }[] };
  attendancePct: number;
  departments: { name: string; attendancePct: number; headcount: number }[];
  employees: InternalEmployeeRow[];
  leave?: {
    pending: number;
    approvedDays: number;
    clashes: number;
    byType?: { name: string; value: number }[];
  };
  payroll?: {
    net: number | null;
    warningPct: number;
  };
};

export type ModelFlightRisk = {
  department: string;
  flightRisk: number;
  tenureDays: number;
};

export type ModelSnapshot = {
  health: InternalSnapshot["health"];
  attendancePct: number;
  departments: InternalSnapshot["departments"];
  leave?: InternalSnapshot["leave"];
  payroll?: InternalSnapshot["payroll"];
  flightRisk: ModelFlightRisk[];
};
