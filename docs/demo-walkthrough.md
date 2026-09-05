# PeoplePay360 demo walkthrough (5 minutes)

Seeded admin: `admin@oddo.com` / `admin@oddo@1234`. Demo staff password: `Employee@1234`.

## Flow 1 — Allocation / time off to request

Malay owns Time Off types and allocations. Until that lands, show the existing leave request on **People → Leave** (Sarah Mills, approved paid leave) and employee self-service **My Leave**.

## Flow 2 — Employee to payslip

1. Sign in as admin or `kimi.nowa@oddo.com` (payroll manager).
2. **HR → Structures**: Regular Salary with BASIC → HRA → STD → GROSS → PF → PT → NET.
3. **HR → Payruns → New payrun**. Choose structure and period, Continue (no row yet), select employees, **Create Payrun**.
4. **Compute**. Aarav Mehta with wage ₹50,000 should show net ₹75,000.
5. Warnings such as **A/C missing** or **No contract for this period** stay visible. Validate is blocked only on missing contract.
6. Payroll manager **Validate** then **Mark paid**.
7. Open a payslip → **Print payslip**. From the payrun, **Send payslips** (SMTP or a failed count toast).

Payroll officer `priya.shah@oddo.com` can draft + compute + send, but cannot mark paid or edit salary rules.
