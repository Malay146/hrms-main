import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toModelSnapshot } from "./sanitize";
import { buildAiSnapshot } from "./build-snapshot";

describe("buildAiSnapshot", () => {
  const employees = [
    {
      id: "p1",
      userId: "u1",
      employeeId: "ODD-2026-001",
      fullName: "Aarav Shah",
      department: "Engineering",
      status: "active" as const,
      paidLeaveBalance: 18,
      bankAccount: "123456",
      wage: 50000,
      createdAt: new Date("2026-01-01"),
    },
  ];

  it("hides named flight-risk and payroll without permission", () => {
    const { data, modelInput } = buildAiSnapshot({
      employees,
      attendance: [
        { userId: "u1", date: "2026-09-01", status: "present", checkIn: new Date("2026-09-01T03:30:00.000Z"), checkOut: new Date("2026-09-01T12:30:00.000Z") },
      ],
      leaves: [
        { userId: "u1", type: "paid", startDate: "2026-09-10", endDate: "2026-09-11", status: "pending", department: "Engineering" },
      ],
      payrollNet: 75000,
      payrunWarningPct: 0,
      weeklyAttendance: [{ day: "Mon", attendance: 1 }],
      periodStart: "2026-08-07",
      periodEnd: "2026-09-05",
      today: "2026-09-05",
      canPeople: false,
      canPayroll: false,
      aiEnabled: false,
      insights: [],
    });
    assert.equal(data.flightRisk.length, 0);
    assert.equal(data.payrollNet, null);
    assert.equal(data.pendingApprovals, 1);
    const text = JSON.stringify(toModelSnapshot(modelInput));
    assert.equal(text.includes("123456"), false);
    assert.equal(text.includes("Aarav"), false);
  });

  it("returns named risk rows when managePeople is granted", () => {
    const { data } = buildAiSnapshot({
      employees,
      attendance: [],
      leaves: [],
      payrollNet: 75000,
      payrunWarningPct: 10,
      weeklyAttendance: [],
      periodStart: "2026-08-07",
      periodEnd: "2026-09-05",
      today: "2026-09-05",
      canPeople: true,
      canPayroll: true,
      aiEnabled: true,
      insights: [],
    });
    assert.equal(data.flightRisk.length, 1);
    assert.equal(data.flightRisk[0]?.name, "Aarav Shah");
    assert.equal(data.payrollNet, 75000);
    assert.equal(data.aiEnabled, true);
  });
});
