import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toModelSnapshot } from "./sanitize";

describe("toModelSnapshot", () => {
  it("strips bank accounts and per-employee wages", () => {
    const out = toModelSnapshot({
      health: { score: 82, band: "healthy", parts: [] },
      attendancePct: 94,
      departments: [{ name: "Engineering", attendancePct: 88, headcount: 12 }],
      employees: [
        {
          name: "Aarav",
          bankAccount: "123456",
          wage: 50000,
          flightRisk: 40,
          department: "Engineering",
          tenureDays: 120,
        },
      ],
    });
    const text = JSON.stringify(out);
    assert.equal(text.includes("123456"), false);
    assert.equal(text.includes("50000"), false);
    assert.equal(text.includes("Aarav"), false);
    assert.equal(Array.isArray(out.flightRisk), true);
    assert.equal(out.flightRisk[0]?.department, "Engineering");
    assert.equal(out.flightRisk[0]?.flightRisk, 40);
    assert.equal(out.flightRisk[0]?.tenureDays, 120);
  });
});
