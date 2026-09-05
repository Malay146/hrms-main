import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computePayslip, evaluateFormula, roundMoney } from "./compute";
import type { ComputeRule } from "./compute";

const regularSalary: ComputeRule[] = [
  {
    name: "Basic Salary",
    code: "BASIC",
    category: "basic",
    sequence: 1,
    computation: "percent_of_wage",
    percentage: 100,
  },
  {
    name: "House Rent Allowance",
    code: "HRA",
    category: "allowance",
    sequence: 10,
    computation: "percent_of_basic",
    percentage: 40,
  },
  {
    name: "Standard Allowance",
    code: "STD",
    category: "allowance",
    sequence: 20,
    computation: "fixed",
    amount: 10000,
  },
  {
    name: "Gross Salary",
    code: "GROSS",
    category: "gross",
    sequence: 50,
    computation: "formula",
    formula: "categories.basic + categories.allowance",
  },
  {
    name: "Provident Fund",
    code: "PF",
    category: "deduction",
    sequence: 60,
    computation: "fixed",
    amount: 3000,
  },
  {
    name: "Professional Tax",
    code: "PT",
    category: "deduction",
    sequence: 70,
    computation: "fixed",
    amount: 2000,
  },
  {
    name: "Net Salary",
    code: "NET",
    category: "net",
    sequence: 100,
    computation: "formula",
    formula: "categories.gross - categories.deduction",
  },
];

describe("computePayslip", () => {
  it("matches the Excalidraw Regular Salary example", () => {
    const result = computePayslip(regularSalary, {
      wage: 50000,
      workedDays: 22,
      scheduledDays: 22,
      unpaidLeaveDays: 0,
    });

    const byCode = Object.fromEntries(result.lines.map((line) => [line.code, line.amount]));
    assert.equal(byCode.BASIC, 50000);
    assert.equal(byCode.HRA, 20000);
    assert.equal(byCode.STD, 10000);
    assert.equal(byCode.GROSS, 80000);
    assert.equal(byCode.PF, 3000);
    assert.equal(byCode.PT, 2000);
    assert.equal(byCode.NET, 75000);
    assert.equal(result.gross, 80000);
    assert.equal(result.net, 75000);
  });

  it("prorates basic from worked days via formula", () => {
    const rules: ComputeRule[] = [
      {
        name: "Basic Salary",
        code: "BASIC",
        category: "basic",
        sequence: 1,
        computation: "formula",
        formula: "wage * (workedDays / scheduledDays)",
      },
      {
        name: "Gross Salary",
        code: "GROSS",
        category: "gross",
        sequence: 50,
        computation: "formula",
        formula: "categories.basic",
      },
      {
        name: "Net Salary",
        code: "NET",
        category: "net",
        sequence: 100,
        computation: "formula",
        formula: "categories.gross - categories.deduction",
      },
    ];

    const result = computePayslip(rules, {
      wage: 50000,
      workedDays: 11,
      scheduledDays: 22,
      unpaidLeaveDays: 11,
    });

    assert.equal(result.lines[0]?.amount, 25000);
    assert.equal(result.net, 25000);
  });

  it("supports percent of a named earlier rule", () => {
    const rules: ComputeRule[] = [
      {
        name: "Basic Salary",
        code: "BASIC",
        category: "basic",
        sequence: 1,
        computation: "fixed",
        amount: 40000,
      },
      {
        name: "Bonus",
        code: "BONUS",
        category: "allowance",
        sequence: 10,
        computation: "percent_of_category",
        percentage: 10,
        percentBaseCode: "BASIC",
      },
    ];
    const result = computePayslip(rules, {
      wage: 40000,
      workedDays: 1,
      scheduledDays: 1,
      unpaidLeaveDays: 0,
    });
    assert.equal(result.lines[1]?.amount, 4000);
  });
});

describe("evaluateFormula", () => {
  it("reads byCode and strips result =", () => {
    const value = evaluateFormula("result = byCode['BASIC'] * 0.12", {
      wage: 0,
      workedDays: 0,
      scheduledDays: 1,
      unpaidLeaveDays: 0,
      categories: {
        basic: 50000,
        allowance: 0,
        gross: 0,
        deduction: 0,
        net: 0,
        contribution: 0,
      },
      byCode: { BASIC: 50000 },
    });
    assert.equal(roundMoney(value), 6000);
  });

  it("rejects unsafe formula text", () => {
    assert.throws(() =>
      evaluateFormula("process.exit(1)", {
        wage: 0,
        workedDays: 0,
        scheduledDays: 1,
        unpaidLeaveDays: 0,
        categories: {
          basic: 0,
          allowance: 0,
          gross: 0,
          deduction: 0,
          net: 0,
          contribution: 0,
        },
        byCode: {},
      }),
    );
  });
});
