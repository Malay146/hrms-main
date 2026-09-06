# PeoplePay360 — Krishil’s Track (Payroll / Config / Demo)

> **Partner:** Malay owns People / HR Ops (`IMPLEMENTATION-MALAY.md`).  
> **Do not edit Malay’s files** (listed below). Coordinate only at the named merge gates.

**Goal:** Salary engine → Structures/Rules → Payruns/Payslips/PDF/Email → Live dashboard → User Management → Seed/demo, consuming Malay’s contracts, schedules, attendance, and leave.

**Spec:** `IMPLEMENTATION.md` (source of truth). Brand: `DESIGN.md`.

---

## Parallel rules (read first)

| Rule | Detail |
| --- | --- |
| Branch | `feat/krishil-payroll` from `main` (rebase after Malay’s Phase 0 schema merge) |
| Own these trees | `lib/payroll/**`, `lib/actions/salary.ts`, `lib/actions/payruns.ts`, `lib/actions/payroll-dashboard.ts`, `lib/actions/users.ts`, `app/admin/hr/**`, `app/admin/users/**`, `docs/demo-walkthrough.md`, `docs/demo-roadmap.md`, final `prisma/seed.ts` extensions for payroll demo |
| May import (read-only) | `lib/contract-period.ts`, `lib/attendance-metrics.ts`, `lib/time-off-balance.ts`, `lib/permissions.ts` |
| Never touch | `app/admin/people/**` (except reading), `lib/actions/{departments,schedules,employees,contracts,attendance,leave,allocations,time-off-types,profile}.ts`, `lib/schedule-hours.ts`, `lib/contract-period.ts` (Malay owns edits), `components/layout/attendance-widget.tsx` |
| Schema | **Malay owns Phase 0 migration.** After it lands, you do **not** rewrite `schema.prisma` unless you add a tiny follow-up migration with Malay’s OK. |
| Sidebar | After Malay’s Phase 0, only add/adjust **Payroll + Users** nav entries in a dedicated small PR if missing — avoid rewriting People sections. |
| Navbar | Do not edit (Malay’s attendance widget). |
| Commits | One commit per task. Never commit `.env`. |

**Start order:** You can begin **Phase 1 pure engine** (`lib/payroll/compute.ts`) immediately on a branch. **Do not** open PRs that need new DB tables until Malay’s schema is merged.

---

## Your 5 phases

```
Phase 1  Salary computation engine + Structures/Rules UI     (engine can start before schema)
Phase 2  Payrun warnings + two-step wizard
Phase 3  Compute → Validate → Mark Paid + retire old Payroll UI
Phase 4  Payslip detail, PDF, email send
Phase 5  Live dashboard + User Management + seed/demo docs
```

Maps to original `IMPLEMENTATION.md` Phases 6–10 (+ users).

---

## Phase 1 — Salary engine + structures/rules

### Task 1.1 — Ordered salary computation (pure) — **can start now**

**Files:** `lib/payroll/compute.ts`, `lib/payroll/compute.test.ts`

No Prisma required. Excalidraw example must pass (BASIC 50000 → NET 75000). Formula sandbox — no Python / no `eval` of unvalidated strings. See `IMPLEMENTATION.md` Task 6.1.

```bash
npx tsx --test lib/payroll/compute.test.ts
```

**Commit:** `feat: add sequenced salary-rule computation engine`

### Task 1.2 — Structure + rule CRUD UI

**Depends on:** Malay Phase 0 schema merged.

**Files:** `lib/actions/salary.ts`, `app/admin/hr/payroll/structures/**`, `app/admin/hr/payroll/rules/**`

- HR Payroll User: read-only.
- Manager/Admin: CRUD.
- Seed “Regular Salary” with the Excalidraw rule table (in seed or action bootstrap).

**Commit:** `feat: configure salary structures and rules that the engine will run`

---

## Phase 2 — Payrun warnings + wizard

### Task 2.1 — Warnings helper (pure)

**Files:** `lib/payroll/warnings.ts`, `lib/payroll/warnings.test.ts`

Missing bank / no contract / duplicate.

**Commit:** `feat: surface payrun warnings for missing bank, contract, and duplicates`

### Task 2.2 — Two-step create wizard

**Files:** `lib/actions/payruns.ts`, replace `app/admin/hr/payroll/page.tsx` + `payrun-wizard.tsx`, `app/admin/hr/payroll/[id]/page.tsx`

1. Scope (type, structure, period) — **no DB write** on Continue.  
2. Select employees.  
3. **Create Payrun** inserts `Payrun` + draft `Payslip` rows only for selected employees.

Hide / stop using old month `upsertPayroll` editor.

**Commit:** `feat: create payruns only after structure, period, and employee selection`

**Depends on:** Malay contracts existing for “eligible employees” (graceful empty if none yet).

---

## Phase 3 — Compute → Validate → Mark Paid + cutover

### Task 3.1 — Workflow buttons

**Files:** `lib/actions/payruns.ts`, `app/admin/hr/payroll/[id]/payrun-form.tsx`

- COMPUTE (`editPayroll`): `contractForPeriod` (import Malay’s helper) + worked days from attendance/leave + `computePayslip` → lines, gross, net, warnings, status `computed`.
- VALIDATE (`finalizePayroll`): block hard “No contract”; allow A/C missing as warning.
- MARK PAID (`finalizePayroll`): immutable `paid`.

**Commit:** `feat: compute, validate, and mark payruns paid from contract and salary rules`

**Best after:** Malay Phase 3 (contracts) + Phase 4 attendance/leave for realistic worked days. You can stub worked days = scheduled days until then.

### Task 3.2 — Remove old payroll editor

**Files:** Stop using `model Payroll` in UI/actions; optional drop migration **with Malay OK**.

**Commit:** `refactor: replace month payroll rows with payruns and payslips`

---

## Phase 4 — Payslips PDF + email

### Task 4.1 — Payslip list + detail + print

**Files:** `app/admin/hr/payroll/payslips/**`, print-friendly page (prefer HTML + print CSS over new PDF libs).

**Commit:** `feat: show payslip computation and printable PDF`

### Task 4.2 — Send Payslips

**Files:** `lib/mail.ts` (`sendPayslipEmail`), `sendPayslipsAction` in payruns

Bulk email; toast sent vs failed.

**Commit:** `feat: email payslips to employees from a payrun`

---

## Phase 5 — Dashboard + Users + demo package

### Task 5.1 — Payroll dashboard aggregations

**Files:** `lib/actions/payroll-dashboard.ts`, optional `lib/payroll/dashboard-metrics.test.ts`

KPIs: total net paid, payslips paid/pending, avg net, approved time-off days, attendance health. Charts zinc grayscale. Alerts: bank, duplicates, drafts, expiring contracts.

**Files UI:** `components/section/dashboard.tsx`, `app/admin/page.tsx`  
**Conflict note:** Malay may still have ops widgets — replace Open Position mock; keep attendance/time-off cards for HR Manager; payroll cards empty with “No payroll access” when permission missing.

**Commit:** `feat: build payroll dashboard from live HR and payslip data`

### Task 5.2 — Dashboard filters

Period / Department / Employee Type via searchParams or action.

**Commit:** `feat: filter dashboard by period, department, and employee type`

### Task 5.3 — Admin User Management

**Files:** `lib/actions/users.ts`, `app/admin/users/**`

List/edit role, link employee, disable account. Do not let users change their own role.

**Commit:** `feat: add admin user management linked to employee records`

### Task 5.4 — Seed + demo docs

**Files:** extend `prisma/seed.ts` (payroll structures, sample payruns, Aarav-style demo), `docs/demo-walkthrough.md`, `docs/demo-roadmap.md`

Keep `admin@odoo.com` / `admin@odoo@1234`. Leave Recruitment / Performance / Analytics / Notifications as mock.

**Commit:** `chore: seed full employee-to-payslip demo` + `docs: add hackathon demo script and future roadmap`

---

## What you do **not** build

| Item | Owner |
| --- | --- |
| Department / Schedule CRUD | Malay |
| Employee kanban / form hub | Malay |
| Contracts UI | Malay (you only call `contractForPeriod`) |
| Attendance widget / form | Malay |
| Time Off types / allocations / request rewrite | Malay |
| Schema foundation migration | Malay |
| Recruitment / Performance / AI | Out of scope |

---

## Sync checklist with Malay

| When | Action |
| --- | --- |
| Before Task 1.2 | Wait for Malay Phase 0 schema on `main` |
| Before realistic Compute | Prefer Malay Phase 3–4 merged; else stub worked days |
| Dashboard | Rebase onto Malay so department/attendance queries exist |
| Seed | Malay may seed people first; you append payroll demo data last |
| File fight | Never edit `app/admin/people/**` or Malay’s pure helpers |

---

## Test commands (your track)

```bash
npx tsx --test lib/payroll/compute.test.ts
npx tsx --test lib/payroll/warnings.test.ts
npx prisma validate
npm run build
```

Browser (after Malay People is usable):

1. Payroll user can Draft + Compute; cannot Mark Paid; cannot edit salary rules.  
2. Manager/Admin can Validate + Mark Paid + edit rules.  
3. Wizard Continue does not insert; Create Payrun inserts selected only.  
4. Compute matches Regular Salary numbers for seeded wage.  
5. A/C missing warning; Print + Send.  
6. Dashboard filters change numbers; employee cannot open `/admin/hr/payroll`.

---

## Suggested calendar (parallel)

| Day chunk | Malay | Krishil |
| --- | --- | --- |
| 1 | Phase 0 schema + permissions | Phase 1.1 compute engine (pure) |
| 1–2 | Phase 1 Departments/Schedules | Wait for schema → Phase 1.2 structures UI |
| 2–3 | Phase 2–3 Employees + Contracts | Phase 2 wizard |
| 3–4 | Phase 4 Attendance + Time Off | Phase 3–4 Compute + PDF/email |
| 4–5 | Bugfix People | Phase 5 Dashboard + Users + seed/demo |
