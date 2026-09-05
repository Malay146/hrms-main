import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSingleRunning,
  contractForPeriod,
  windowsOverlap,
  type ContractWindow,
} from "./contract-period";

describe("contract period rules", () => {
  it("detects overlapping windows", () => {
    const a: ContractWindow = {
      id: "1",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      status: "running",
    };
    const b: ContractWindow = {
      id: "2",
      startDate: "2026-06-01",
      endDate: null,
      status: "running",
    };
    assert.equal(windowsOverlap(a, b), true);
  });

  it("rejects overlapping running contracts", () => {
    const existing: ContractWindow[] = [
      {
        id: "1",
        startDate: "2026-01-01",
        endDate: null,
        status: "running",
      },
    ];
    const next: ContractWindow = {
      id: "2",
      startDate: "2026-03-01",
      endDate: "2026-12-31",
      status: "running",
    };
    assert.match(
      assertSingleRunning(next, existing) ?? "",
      /two Running contracts/i,
    );
  });

  it("allows expired and running when dates do not overlap", () => {
    const existing: ContractWindow[] = [
      {
        id: "1",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        status: "expired",
      },
    ];
    const next: ContractWindow = {
      id: "2",
      startDate: "2026-01-01",
      endDate: null,
      status: "running",
    };
    assert.equal(assertSingleRunning(next, existing), null);
  });

  it("picks the covering running contract for a pay period", () => {
    const contracts: ContractWindow[] = [
      {
        id: "old",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        status: "expired",
      },
      {
        id: "run",
        startDate: "2026-01-01",
        endDate: null,
        status: "running",
      },
      {
        id: "future",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        status: "expired",
      },
    ];
    const picked = contractForPeriod(contracts, "2026-03-01", "2026-03-31");
    assert.equal(picked?.id, "run");
  });
});
