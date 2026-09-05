# PeoplePay360 — Malay’s Track (People / HR Ops)

> **Partner:** Krishil owns Payroll (`IMPLEMENTATION-KRISHIL.md`).  
> **Do not edit Krishil’s files** (listed below). Coordinate only at the named merge gates.

**Goal:** Departments → Schedules → Employee hub → Contracts → Attendance → Time Off, so Krishil’s payruns can consume real contracts, schedules, attendance, and leave.

**Spec:** `IMPLEMENTATION.md` (source of truth for product rules). Brand: `DESIGN.md`.

---

## Parallel rules (read first)

| Rule | Detail |
| --- | --- |
| Branch | `feat/malay-people-hr` from `main` |
| Own these trees | `app/admin/people/**`, `lib/actions/departments.ts`, `lib/actions/schedules.ts`, `lib/actions/employees.ts`, `lib/actions/contracts.ts`, `lib/actions/attendance.ts`, `lib/actions/leave.ts`, `lib/actions/allocations.ts`, `lib/actions/time-off-types.ts`, `lib/actions/profile.ts`, `lib/schedule-hours.ts`, `lib/contract-period.ts`, `lib/attendance-metrics.ts`, `lib/time-off-balance.ts`, `lib/leave-rules.ts`, `components/layout/attendance-widget.tsx` |
| Shared (Malay owns for Phases 0–1) | `prisma/schema.prisma`, `prisma/migrations/**`, `lib/permissions.ts`, `components/layout/sidebar.tsx` |
| Never touch | `app/admin/hr/**`, `lib/payroll/**`, `lib/actions/salary.ts`, `lib/actions/payruns.ts`, `lib/actions/payroll*.ts`, `lib/actions/users.ts`, `app/admin/users/**`, `lib/mail.ts` (except if Krishil asks), Krishil’s commits |
| Navbar | You may edit `components/layout/navbar.tsx` **only** to mount `attendance-widget` (Phase 4). Do not rewrite other navbar chrome. |
| Commits | One commit per task. Never commit `.env`. |

**Gate before Krishil Phase 2 UI:** Your Phase 0 schema migration must be on `main` (or merged) so payroll tables exist.

---

## Your 5 phases

```
Phase 0  Foundations (schema + permissions + People nav)     ← BLOCKING for Krishil schema
Phase 1  Departments + Working Schedules
Phase 2  Employee hub (form + kanban)
Phase 3  Contracts (+ period helper)
Phase 4  Attendance + Time Off (combined final People phase)
```

Original `IMPLEMENTATION.md` Phases 0–5 + attendance widget map onto these five.

---

## Phase 0 — Foundations (schema + permissions + People nav)

**Why you own this:** One person must write `schema.prisma` / migrations once. Krishil waits for this merge before payroll actions that need new tables.

### Task 0.1 — Permissions + path gates

**Files:** `lib/permissions.ts`, create `lib/permissions.test.ts`

- Implement PDF matrix from `IMPLEMENTATION.md` §3 (`finalizePayroll`, `manageSalaryConfig`, payroll user gets `managePeople`, etc.).
- Extend `canAccessAdminPath` for People + Payroll + `/admin/users` routes (even if Krishil builds the pages later).

```bash
npx tsx --test lib/permissions.test.ts
```

**Commit:** `feat: align staff permissions with PeoplePay360 role matrix`

### Task 0.2 — Prisma domain migration

**Files:** `prisma/schema.prisma`, new migration, minimal `prisma/seed.ts` updates so `admin@oddo.com` still logs in

- Add all models from `IMPLEMENTATION.md` §4 (Department, WorkingSchedule, Contract, TimeOff*, Salary*, Payrun, Payslip, …).
- `EmployeeProfile.department` String → `departmentId` with backfill.
- **Do not drop** old `Payroll` table yet (Krishil Phase 3).
- Include payroll tables even though Krishil fills them — empty tables are fine.

```bash
npx prisma validate
npx prisma migrate dev --name oxp_domain
npm run db:seed
```

**Commit:** `feat: add contracts, schedules, time-off, salary, and payrun schema`

**→ Merge to main / notify Krishil: schema ready.**

### Task 0.3 — Sidebar People IA + stub routes

**Files:** `components/layout/sidebar.tsx` + stub pages:

- `app/admin/people/contracts/page.tsx`
- `app/admin/people/schedules/page.tsx`
- `app/admin/people/leave/allocations/page.tsx`
- `app/admin/people/leave/types/page.tsx`
- Stub link only for Payroll children / Users (Krishil owns real pages) — hrefs may 404 until he lands them; prefer empty shells if easy.

**Do not** implement payroll UI here.

**Commit:** `feat: map sidebar to Employees, Contracts, Schedules, Time Off, Payroll`

---

## Phase 1 — Departments + Working Schedules

### Task 1.1 — Department CRUD

**Files:** `lib/actions/departments.ts` (replace mock), validations, `app/admin/people/department/**`

Persist list/create/rename. Employees will select departments in Phase 2.

**Commit:** `feat: persist departments instead of mock cards`

### Task 1.2 — Schedule hours (pure)

**Files:** `lib/schedule-hours.ts`, `lib/schedule-hours.test.ts`

See `IMPLEMENTATION.md` Task 1.2 tests (`lineHours`, `weeklyHours`, `daysPerWeek`).

**Commit:** `feat: derive weekly hours from schedule lines`

### Task 1.3 — Schedule list + form

**Files:** `lib/actions/schedules.ts`, `app/admin/people/schedules/**`

List: name, calendar type, days/week, hours/week, status. Form derives total weekly hours (read-only).

**Commit:** `feat: add working schedule list and form`

---

## Phase 2 — Employee hub

### Task 2.1 — Employee form + update action

**Files:** `lib/actions/employees.ts` (`updateEmployeeAction`), `app/admin/people/employees/[id]/**`

Work / Private / HR tabs. Smart buttons with `?employeeId=` to contracts, attendance, leave, allocations.

**Commit:** `feat: make the employee record the HR hub with work and private fields`

### Task 2.2 — Kanban + List

**Files:** `app/admin/people/employees/employees-client.tsx`

Default Kanban; toggle List; both open same form.

**Commit:** `feat: add employee kanban and list views that share one form`

---

## Phase 3 — Contracts

### Task 3.1 — Contract period helper (pure)

**Files:** `lib/contract-period.ts`, `lib/contract-period.test.ts`

Overlap + `contractForPeriod` — Krishil will **import** this in payrun Compute (read-only for him).

**Commit:** `feat: enforce one running contract per period`

### Task 3.2 — Contract list + form

**Files:** `lib/actions/contracts.ts`, `app/admin/people/contracts/**`

Honor `?employeeId=`. Codes `CON/YYYY/NNNN`. Running/Expired.

**Commit:** `feat: add employee contracts with running/expired history`

**→ Merge when Phase 3 done so Krishil can rely on contracts for Compute.**

---

## Phase 4 — Attendance + Time Off

### Task 4.1 — Attendance metrics (pure)

**Files:** `lib/attendance-metrics.ts`, `lib/attendance-metrics.test.ts`; soft-touch `lib/dates.ts` (fallback late only)

**Commit:** `feat: compute attendance hours and exceptions from the working schedule`

### Task 4.2 — Attendance form + HR upsert

**Files:** `lib/actions/attendance.ts`, `app/admin/people/attendance/**`

Worked hours, `manualEdit`, `?employeeId=` filter.

**Commit:** `feat: add attendance form with manual corrections and worked hours`

### Task 4.3 — Navbar attendance widget

**Files:** `components/layout/attendance-widget.tsx`, minimal mount in `navbar.tsx`

**Commit:** `feat: add navbar check-in/out popup with elapsed time`

### Task 4.4 — Time off balance (pure)

**Files:** `lib/time-off-balance.ts`, `lib/time-off-balance.test.ts`

**Commit:** `feat: consume approved allocations when time off is approved`

### Task 4.5 — Types + Allocations + Requests rewrite

**Files:** `lib/actions/time-off-types.ts`, `lib/actions/allocations.ts`, rewrite `lib/actions/leave.ts`, `app/admin/people/leave/**`, `app/employee/leave/**`

Sidebar Time Off children only. Seed Paid / Sick / Unpaid / Comp Off.

**Commit:** `feat: drive time off requests from types and allocations`

**→ Final People merge.** Krishil’s dashboard / payrun worked-days can read your data.

---

## What you do **not** build

| Item | Owner |
| --- | --- |
| Salary structures / rule engine | Krishil |
| Payrun wizard / compute / PDF / email | Krishil |
| Payroll dashboard KPIs | Krishil |
| `/admin/users` | Krishil |
| Dropping old `Payroll` table | Krishil |
| Final demo seed with payruns | Krishil (you may add people rows earlier; he extends seed) |
| Recruitment / Performance / Analytics | Out of scope |

---

## Sync checklist with Krishil

| When | Action |
| --- | --- |
| After Phase 0.2 | Merge schema; tell Krishil he can start salary tables / actions |
| After Phase 3 | Contracts usable for `contractForPeriod` |
| After Phase 4 | Attendance + leave ready for worked-days + dashboard |
| Conflicts | If both need `sidebar.tsx` after Phase 0, **only Malay** edits People children; Krishil PRs Payroll children in a short coordinated PR |

---

## Test commands (your track)

```bash
npx tsx --test lib/permissions.test.ts
npx tsx --test lib/schedule-hours.test.ts
npx tsx --test lib/contract-period.test.ts
npx tsx --test lib/attendance-metrics.test.ts
npx tsx --test lib/time-off-balance.test.ts
npx prisma validate
```

Browser: login `admin@oddo.com` / `admin@oddo@1234` — employee kanban, contracts, attendance widget, allocation → request → approve.
