import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPayslipEmailHtml,
  buildPayslipEmailText,
  escapeHtml,
  formatInr,
} from "./payslip-email";
import { payrollMonthRange, payslipIssueMonth } from "./dates";

const sample = {
  fullName: "Asha Rao",
  employeeCode: "EMP/2026/001",
  department: "Engineering",
  periodLabel: "1 Sep 2026 – 30 Sep 2026",
  structureName: "Regular Salary",
  workedDays: 22,
  gross: 80000,
  net: 75000,
  lines: [
    { name: "Basic Salary", code: "BASIC", category: "basic", amount: 50000 },
    { name: "HRA", code: "HRA", category: "allowance", amount: 20000 },
    { name: "Provident Fund", code: "PF", category: "deduction", amount: 3000 },
  ],
};

describe("payslip email template", () => {
  it("formats INR with two decimal places", () => {
    assert.equal(formatInr(75000), "₹75,000.00");
  });

  it("escapes HTML in names", () => {
    assert.equal(escapeHtml(`Asha <script>alert("x")</script>`), "Asha &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("builds a zinc HTML statement with employee, net, and line items", () => {
    const html = buildPayslipEmailHtml(sample);
    assert.match(html, /Asha Rao/);
    assert.match(html, /EMP\/2026\/001/);
    assert.match(html, /Engineering/);
    assert.match(html, /Regular Salary/);
    assert.match(html, /Basic Salary/);
    assert.match(html, /#18181B/);
    assert.match(html, /₹75,000\.00/);
    assert.doesNotMatch(html, /<script>/);
  });

  it("builds a plain-text fallback", () => {
    const text = buildPayslipEmailText(sample);
    assert.match(text, /Hi Asha Rao/);
    assert.match(text, /Net salary: ₹75,000\.00/);
    assert.match(text, /Provident Fund: -₹3,000\.00/);
  });
});

describe("payslip issue month", () => {
  it("issues the current month on the last two days", () => {
    assert.equal(payslipIssueMonth(new Date("2026-09-30T10:00:00+05:30")), "2026-09");
    assert.equal(payslipIssueMonth(new Date("2026-09-29T10:00:00+05:30")), "2026-09");
  });

  it("issues the previous month earlier in the month", () => {
    assert.equal(payslipIssueMonth(new Date("2026-10-01T10:00:00+05:30")), "2026-09");
    assert.equal(payslipIssueMonth(new Date("2026-01-15T10:00:00+05:30")), "2025-12");
  });

  it("returns the inclusive date range for a payroll month", () => {
    assert.deepEqual(payrollMonthRange("2026-09"), { start: "2026-09-01", end: "2026-09-30" });
    assert.deepEqual(payrollMonthRange("2026-02"), { start: "2026-02-01", end: "2026-02-28" });
  });
});
