# PeoplePay360 / OXP HR & Payroll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current Next.js HRMS into a connected PeoplePay360 platform that matches the hackathon problem statement: employee hub → contracts/schedules → attendance/time off → salary rules → payruns/payslips/PDF/email → live payroll dashboard.

**Architecture:** Keep the existing Next.js 16 App Router, Prisma 7, PostgreSQL, Better Auth, and zinc UI shell. Replace the simplified `Payroll` / string-department / hardcoded leave-type model with parent-child domain tables. Put all business rules (contract-for-period, schedule hours, allocation consumption, ordered salary rules, payrun warnings) in pure TypeScript modules under `lib/` with `tsx --test` coverage before wiring Server Actions and pages.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL, Better Auth, Zod, Nodemailer, Recharts, Geist / zinc design system (`DESIGN.md`). Formula engine is a sandboxed expression evaluator — do **not** execute Python.

**Spec sources (read before every phase):**
- Problem statement: [`PeoplePay360 HR & Payroll.pdf`](../../PeoplePay360%20HR%20&%20Payroll.pdf) (11 pages, in this repo)
- Functional screen flow: [`HRMS OXP - 24 hours.excalidraw`](../../HRMS%20OXP%20-%2024%20hours.excalidraw)
- Brand: [`DESIGN.md`](../../DESIGN.md) and `.cursor/rules/hrms-brand.mdc`

**UI rules for every page:** `w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6`. H1 `text-h1 font-medium`. Primary buttons `rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98`. Charts grayscale zinc only. No blue primary CTAs. No new typefaces or icon packs.

---

## 0. How to read this plan

Implement **in phase order**. Later payroll math depends on contracts, schedules, allocations, and salary rules. Do not start Payruns until Phases 1–6 exist.

Each task is TDD for domain logic, then a thin Server Action, then a page. After each task: run the named test command, then commit.

Test command pattern (existing harness):

```bash
npx tsx --test lib/<module>.test.ts
```

Update `package.json` `"test"` when new files are added so `npm test` runs the whole suite.

---

## 1. What is already implemented (do not rebuild)

These exist and work against PostgreSQL. Reuse them; extend rather than rewrite.

| Area | What exists | Files |
| --- | --- | --- |
| Login | Better Auth email/password, httpOnly cookies, `issuer = local:credential` | `lib/auth.ts`, `app/login/`, `proxy.ts` |
| No public signup | `/sign-up` redirects; `disableSignUp: true` | `lib/auth.ts`, `app/sign-up/` |
| Admin-provisioned users | Create employee + User + Account, generated password, Gmail SMTP, first-login `/change-password` | `lib/actions/employees.ts`, `lib/mail.ts`, `app/change-password/` |
| Roles enum | `admin`, `hr_manager`, `hr_payroll_user`, `hr_payroll_manager`, `employee` | `prisma/schema.prisma`, `lib/permissions.ts` |
| Dual portals | `/admin` staff app, `/employee` self-service, navbar switch | `app/admin/layout.tsx`, `app/employee/layout.tsx`, `components/layout/navbar.tsx` |
| Employee directory | List + create form + read-only detail (name, dept string, job, phone, status) | `app/admin/people/employees/` |
| Attendance | Global list, unique daily check-in, employee clock in/out, Asia/Kolkata | `lib/actions/attendance.ts`, `lib/dates.ts` |
| Time off (simplified) | paid/sick/unpaid, overlap, approve/reject + comment, paid balance on `EmployeeProfile.paidLeaveBalance` | `lib/actions/leave.ts`, `lib/leave-rules.ts` |
| Payroll (wrong model) | Per-employee month row with basic / HRA% / allowance% / deductions / generated `net_salary` | `lib/actions/payroll.ts`, `app/admin/hr/payroll/` |
| Admin dashboard (partial) | Live headcount, present, leave today, pending leave, weekly attendance bars, dept pie | `lib/actions/dashboard.ts`, `components/section/dashboard.tsx` |
| Employee dashboard | Clock widget on self-service home (persisted) | `app/employee/employee-dashboard-client.tsx` |

---

## 2. Complete gap list — everything still to implement

Status key: **Missing** = not in schema/UI. **Partial** = screen or data exists but does not match the PDF/Excalidraw. **Mock** = UI only, hardcoded. **Out of spec** = current extra modules; keep last.

### 2.1 Login & user access (PDF §3, Excalidraw §0)

| Feature | Status | Notes |
| --- | --- | --- |
| Admin creates accounts | Done | Combined with employee create |
| Role-gated modules after login | Partial | Matrix does not match PDF (see §3) |
| Users cannot self-elevate | Done enough | Roles assigned only by `createUsers` |
| **User record separate from Employee, then linked** | Missing | Today `createEmployeeAction` always creates both together |
| **Admin-only User Management list/form** | Missing | No `/admin/users`. Excalidraw: search users, role filter, link to existing employee, multi-role, account status |
| Multi-role per user | Missing | Schema is single `User.role` string. Spec: “assign one or more roles”. Implement as primary role + optional extra flags **or** keep one role (hackathon) and document. **Decision: keep one role** to match existing Better Auth + `permissions.ts`. Do not add multi-role unless time remains in Phase 9. |
| Forgot password | Missing | Excalidraw enhancement, not required |
| Invitations / SSO | Missing | Explicitly optional in Excalidraw |
| Employee self-service: own profile, attendance, leave only | Partial | Profile is thin; no contract/schedule/allocations |

### 2.2 Employees (PDF A1/B1/B2)

| Feature | Status |
| --- | --- |
| Kanban **and** List, both open the same Employee Form | Missing (list only) |
| Work Information: department FK, manager, working schedule, job position, company, work location, status | Partial (department is a free string; no manager/schedule/location/company) |
| Private Information tab (personal email, address, bank account for payroll warnings) | Missing |
| HR Settings tab | Missing |
| Employee type (full-time / intern / contractor) for payrun + dashboard filters | Partial (`type` shown on detail but not a real field) |
| Smart buttons: Contracts / Attendance / Time Off / Allocations with counts, filtered to that employee | Missing |
| Join date, employment history via contracts | Missing |

### 2.3 Contracts (PDF A2)

| Feature | Status |
| --- | --- |
| Contract list + form | Missing |
| History (expired + running) | Missing |
| Fields: start, end, wage/month, department, position, salary structure, schedule, status Running/Expired | Missing |
| One Running contract per employee per overlapping period | Missing |
| Payroll uses the contract that covers the pay period (not “latest” blindly) | Missing |
| Navigate from employee smart button with `Employee = …` filter | Missing |

### 2.4 Working schedules (PDF A3, Excalidraw schedule wireframes)

| Feature | Status |
| --- | --- |
| Schedule list: name, calendar type, days/week, hours/week, company, status | Missing |
| Schedule form: weekly pattern day / start / end / break / hours; weekly hours **derived** | Missing |
| Assign schedule to employee and/or contract | Missing |
| Attendance/payroll use schedule as expected hours (late, overtime, worked-days) | Missing |

### 2.5 Departments (needed for dashboard + employee form)

| Feature | Status |
| --- | --- |
| Department as a real model with CRUD | Mock (`app/admin/people/department/page.tsx` hardcoded) |
| Employee.departmentId FK | Missing (string column) |

### 2.6 Attendance (PDF B3, Excalidraw §2 + widget)

| Feature | Status |
| --- | --- |
| Global list: check in, check out, worked hours, status | Partial (no worked-hours column / form) |
| Attendance **form** (date, in, out, overtime, notes, manual correction by authorized user) | Missing |
| Filter from employee smart button | Missing |
| Worked hours derived from in/out minus break from schedule | Partial (`workingHours` helper exists, not stored/shown as first-class) |
| Overtime vs schedule expected hours | Missing |
| Late / absent / missing checkout / half-day using schedule | Partial (hardcoded late after 09:15 in `lib/dates.ts`) |
| Navbar **attendance quick widget**: popup Check In / Check Out, elapsed time, green/red status | Missing (clock lives only on employee dashboard) |
| Dashboard: present, late, absent, OT, missing checkouts, manual edits, coverage % | Missing |

### 2.7 Time Off (PDF A4/B4, Excalidraw §3)

| Feature | Status |
| --- | --- |
| Navbar/sidebar **Time Off ▼ → Requests / Allocations / Types only** (no extra page buttons) | Missing (single Leave page) |
| Time Off Types: unit days/hours, requires allocation yes/no, approver Manager/Officer, color, payroll work-entry note | Missing (enum `paid \| sick \| unpaid`) |
| Allocations: allocated / taken / remaining, validity year, approver, approve allocation before it is usable | Missing (`paidLeaveBalance` int on profile) |
| Request form: type, dates, duration, allocation used, reason, Approve / Refuse | Partial (no type FK, no allocation link) |
| If type requires allocation: block submit without remaining balance; approved request consumes that allocation | Missing |
| Comp Off type | Missing |
| Officer vs manager approver routing | Missing |

### 2.8 Salary structures & rules (PDF A5/A6, Excalidraw §5)

| Feature | Status |
| --- | --- |
| Salary Structure list + form (name, active, rule count, employee count) | Missing |
| Salary Rule list + form: name, code, category, sequence, structure | Missing |
| Categories: Basic, Allowance, Gross, Deduction, Net (and contributions if needed) | Missing |
| Computation: Fixed Amount, Percentage of wage/basic/gross/category, Formula | Missing |
| Rules processed in sequence; later rules may read earlier category totals | Missing |
| Structures/rules **actually drive** payslip lines (not mock screens) | Missing — current payroll ignores this entirely |
| HR Payroll User read-only structures/rules; Manager/Admin CRUD | Missing |

### 2.9 Payruns & payslips (PDF B5–B8, Excalidraw §4)

| Feature | Status |
| --- | --- |
| Replace month-row `Payroll` table editor | Current UI is **wrong model** — remove after cutover |
| NEW payrun **wizard**: step 1 scope (employee type, structure, period) does **not** insert; Continue → employee picker; **Create Payrun** inserts only selected employees | Missing |
| Payrun form: name, structure, period, status, payslip table, warnings | Missing |
| Workflow **Draft → Compute → Validate → Mark Paid** | Missing |
| Compute: contract-for-period + structure rules → payslip lines; worked days from attendance/schedule/leave | Missing |
| Warnings: missing bank account, duplicate payslip, missing running contract | Missing |
| Historical paid runs remain readable | Missing |
| Payslip list + detail (employee, structure, payrun, period, status, worked days, rule lines, Basic/Allowances/Deductions/Gross/Net) | Missing |
| Print Payslip PDF | Missing |
| Payrun **Send Payslips** bulk email with PDF | Missing |
| Employee receives email; in-app My Payslips is optional (PDF says employees have no payroll admin) | Missing |

### 2.10 Payroll dashboard (PDF A7/B9, Excalidraw §6)

| Feature | Status |
| --- | --- |
| Live KPIs: Total Net Salary Paid, Payslips Generated (paid/pending), Avg Salary, Approved Time Off days, Attendance Health | Missing (current dashboard is HR ops, Open Position is mock) |
| Filters: Period, Department, Employee Type (Company if time) | Missing (date button is inert) |
| Charts: Salary cost by department, monthly net salary trend — **zinc grayscale**, live data | Partial charts, wrong metrics |
| Payslip status + alerts: missing bank, duplicate, drafts, contracts expiring | Missing |
| Attendance overview: present / late / absent / OT / missing checkouts / manual edits / coverage | Missing |
| Time off overview: approved days, pending, remaining by type | Missing |
| Department overview: headcount + monthly salary | Partial headcount pie only |
| Drill-down links to payruns, payslips, attendance, time off | Missing |
| Data from **multiple models**, not one table | Missing |

### 2.11 Reporting / navigation (PDF B1)

| Feature | Status |
| --- | --- |
| Staff IA: Employees, Contracts, Attendance, Time Off ▼, Payroll (Payruns / Payslips / Structures / Rules / Dashboard), Reports | Partial (People + HR mocks) |
| Keep existing **sidebar** (do not invent a second top-nav chrome that fights `DESIGN.md`) | Map Excalidraw menus onto sidebar children |

### 2.12 Out of spec — do not build in core phases

| Feature | Status | Plan |
| --- | --- | --- |
| Recruitment kanban | Mock | Leave as mock; hide from HR Manager if it distracts, or keep behind `adminExtras` |
| Performance | Coming soon | Leave |
| AI Analytics | Coming soon | Leave |
| Notifications inbox | Static fake data | Leave until Phase 10 |
| Settings password UI | Not wired | Optional Phase 9 |
| Landing marketing metrics | Marketing only | Leave |
| Open Position KPI | Mock | Replace with payroll/HR KPI in Phase 8 |

### 2.13 Hackathon deliverables (PDF §8)

| Deliverable | Status |
| --- | --- |
| Functional platform with representative seed (employees, contracts, time, salary, payroll) | Partial seed (no contracts/structures/payruns) |
| Five-minute walkthrough of two flows: employee→payslip and allocation→request | Missing script |
| Future roadmap blurb | Missing (short `docs/demo-roadmap.md` at the end) |

---

## 3. Target permission matrix (replace `lib/permissions.ts`)

PDF roles — implement these permissions. `hr_payroll_*` **must** get HR master-data access (today they cannot open Employees).

| Permission | employee | hr_manager | hr_payroll_user | hr_payroll_manager | admin |
| --- | --- | --- | --- | --- | --- |
| Self-service: own profile, attendance, time-off request | yes | yes | yes | yes | yes |
| `managePeople` Employees / Departments / Schedules / Contracts / Attendance | | yes | yes | yes | yes |
| `approveLeave` + allocations + types read | | yes | yes | yes | yes |
| `manageTimeOffTypes` | | yes | yes | yes | yes |
| `viewPayrollAll` payruns/payslips | | | yes | yes | yes |
| `editPayroll` create/compute payruns | | | yes | yes | yes |
| `finalizePayroll` validate + mark paid | | | | yes | yes |
| `viewSalaryConfig` | | | yes (read) | yes | yes |
| `manageSalaryConfig` | | | | yes | yes |
| `createUsers` / User Management | | | | | yes |
| Recruitment / Performance / Analytics mocks | | | | | yes (`adminExtras`) |

Path gates in `canAccessAdminPath` must be updated for every new route listed in Phase 0.

**Product split (not explicit in PDF, needed for workflow):** HR Payroll User can Draft + Compute + Send; only HR Payroll Manager and Admin can Validate and Mark Paid.

---

## 4. Target data model

Add these models in **one foundation migration** (Phase 0 Task 2) so later phases only add actions/UI. Keep `User` / Better Auth tables. **Deprecate** `Payroll` after Phase 7 cutover (do not drop until payslips work).

```prisma
enum EmployeeType {
  full_time
  intern
  contractor
}

enum ContractStatus {
  running
  expired
}

enum CalendarType {
  fixed
  variable
}

enum TimeOffUnit {
  days
  hours
}

enum TimeOffApprover {
  manager
  officer
}

enum AllocationStatus {
  draft
  approved
  refused
}

enum SalaryCategory {
  basic
  allowance
  gross
  deduction
  net
  contribution
}

enum RuleComputation {
  fixed
  percent_of_wage
  percent_of_basic
  percent_of_gross
  percent_of_category
  formula
}

enum PayrunStatus {
  draft
  computed
  validated
  paid
}

enum PayslipStatus {
  draft
  computed
  validated
  paid
}

model Department {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  code           String
  profiles       EmployeeProfile[]
  contracts      Contract[]
  @@unique([organizationId, code])
  @@map("department")
}

model WorkingSchedule {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  calendarType   CalendarType @default(fixed)
  timezone       String   @default("Asia/Kolkata")
  active         Boolean  @default(true)
  hoursPerWeek   Decimal  @db.Decimal(6, 2) // derived, stored for list
  daysPerWeek    Int
  lines          WorkingScheduleLine[]
  profiles       EmployeeProfile[]
  contracts      Contract[]
  @@map("working_schedule")
}

model WorkingScheduleLine {
  id         String @id @default(cuid())
  scheduleId String
  weekday    Int    // 1=Mon … 7=Sun
  startMin   Int    // minutes from midnight
  endMin     Int
  breakMin   Int    @default(60)
  hours      Decimal @db.Decimal(4, 2) // derived
  schedule   WorkingSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  @@map("working_schedule_line")
}

model EmployeeProfile {
  // existing fields minus department String
  departmentId     String
  managerId        String?
  scheduleId       String?
  employeeType     EmployeeType @default(full_time)
  workLocation     String?
  companyName      String?
  bankAccount      String?
  personalEmail    String?
  address          String?
  joinDate         DateTime? @db.Date
  // remove paidLeaveBalance once allocations exist
}

model Contract {
  id               String @id @default(cuid())
  code             String @unique // CON/2026/0042
  employeeId       String // EmployeeProfile.id
  departmentId     String?
  scheduleId       String?
  salaryStructureId String?
  jobTitle         String
  wage             Decimal @db.Decimal(12, 2)
  startDate        DateTime @db.Date
  endDate          DateTime? @db.Date
  status           ContractStatus
  notes            String?
  employee         EmployeeProfile @relation(...)
  @@map("contract")
}

model TimeOffType {
  id                 String @id @default(cuid())
  organizationId     String
  name               String
  unit               TimeOffUnit @default(days)
  requiresAllocation Boolean @default(true)
  approver           TimeOffApprover @default(manager)
  color              String @default("zinc")
  payrollNote        String?
  @@map("time_off_type")
}

model TimeOffAllocation {
  id           String @id @default(cuid())
  employeeId   String
  typeId       String
  allocated    Decimal @db.Decimal(8, 2)
  taken        Decimal @db.Decimal(8, 2) @default(0)
  validityYear Int
  status       AllocationStatus @default(draft)
  description  String?
  @@map("time_off_allocation")
}

model LeaveRequest {
  // replace enum type with:
  typeId       String
  allocationId String?
  duration     Decimal @db.Decimal(8, 2)
  // status already exists; map rejected → refused in UI copy
}

model Attendance {
  workedHours  Decimal? @db.Decimal(6, 2)
  overtimeHours Decimal? @db.Decimal(6, 2)
  notes        String?
  manualEdit   Boolean @default(false)
}

model SalaryStructure {
  id             String @id @default(cuid())
  organizationId String
  name           String
  active         Boolean @default(true)
  rules          SalaryRule[]
  @@map("salary_structure")
}

model SalaryRule {
  id            String @id @default(cuid())
  structureId   String
  name          String
  code          String
  category      SalaryCategory
  sequence      Int
  computation   RuleComputation
  amount        Decimal? @db.Decimal(12, 2)
  percentage    Decimal? @db.Decimal(8, 4)
  percentBaseCode String? // when percent_of_category
  formula       String?
  @@map("salary_rule")
}

model Payrun {
  id             String @id @default(cuid())
  organizationId String
  name           String
  structureId    String
  periodStart    DateTime @db.Date
  periodEnd      DateTime @db.Date
  employeeType   EmployeeType?
  status         PayrunStatus @default(draft)
  payslips       Payslip[]
  @@map("payrun")
}

model Payslip {
  id           String @id @default(cuid())
  payrunId     String
  employeeId   String
  contractId   String?
  workedDays   Decimal @db.Decimal(6, 2)
  status       PayslipStatus @default(draft)
  warning      String?
  gross        Decimal @db.Decimal(12, 2) @default(0)
  net          Decimal @db.Decimal(12, 2) @default(0)
  lines        PayslipLine[]
  @@unique([payrunId, employeeId])
  @@map("payslip")
}

model PayslipLine {
  id        String @id @default(cuid())
  payslipId String
  ruleId    String?
  name      String
  code      String
  category  SalaryCategory
  amount    Decimal @db.Decimal(12, 2)
  @@map("payslip_line")
}
```

**Contract-for-period rule:** a contract covers a pay period if `startDate <= periodEnd` and (`endDate` is null or `endDate >= periodStart`). Among covering contracts, prefer `running`; if two running overlap, it is a data error (blocked at save).

---

## 5. Navigation map (sidebar, not a new top bar)

Modify `components/layout/sidebar.tsx` `adminNavItems`:

```
Dashboard            → /admin                         (Phase 8: payroll dashboard)
People
  Employees          → /admin/people/employees
  Contracts          → /admin/people/contracts
  Working Schedules  → /admin/people/schedules
  Departments        → /admin/people/department       (real CRUD)
  Attendance         → /admin/people/attendance
  Time Off
    Requests         → /admin/people/leave
    Allocations      → /admin/people/leave/allocations
    Types            → /admin/people/leave/types
Payroll
  Payruns            → /admin/hr/payroll
  Payslips           → /admin/hr/payroll/payslips
  Structures         → /admin/hr/payroll/structures
  Rules              → /admin/hr/payroll/rules
  Dashboard          → /admin  (same as home) or /admin/hr/payroll/dashboard
Admin only
  Users              → /admin/users
Extras (adminExtras, last)
  Recruitment / Performance / AI Analytics / Notifications / Settings
```

Employee sidebar stays: Dashboard, Profile, Attendance, Leave. Optional later: My Payslips.

Filter `adminNavItems` by `canAccessAdminPath` so HR Manager never sees Payroll children.

---

## 6. Phase order (why)

```
Phase 0  Permissions + schema + nav skeleton
Phase 1  Departments + Working Schedules
Phase 2  Employee Kanban/List/Form hub
Phase 3  Contracts (+ period selection helper)
Phase 4  Attendance form, hours, widget, exceptions
Phase 5  Time Off types, allocations, request consumption
Phase 6  Salary structures, rules, computation engine
Phase 7  Payrun wizard, payslips, PDF, email
Phase 8  Live payroll dashboard
Phase 9  User Management split, leftover access UX
Phase 10 Seed, demo script, extras stay mock, roadmap
```

Payroll is last among cores because Compute needs contract wage, structure rules, worked days, and unpaid leave.

---

## Phase 0 — Foundations

### Task 0.1: Expand permissions and path gates

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `lib/permissions.test.ts` (create)
- Modify: `components/layout/sidebar.tsx` (hide items by permission; add placeholder hrefs that 404 until later phases — **or** add stub pages)

**Step 1: Write the failing test**

Create `lib/permissions.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessAdminPath, hasPermission } from "./permissions";

describe("PDF role matrix", () => {
  it("blocks HR Manager from payroll", () => {
    assert.equal(hasPermission("hr_manager", "viewPayrollAll"), false);
    assert.equal(canAccessAdminPath("hr_manager", "/admin/hr/payroll"), false);
  });

  it("gives payroll user people + payroll edit but not salary config write or finalize", () => {
    assert.equal(hasPermission("hr_payroll_user", "managePeople"), true);
    assert.equal(hasPermission("hr_payroll_user", "editPayroll"), true);
    assert.equal(hasPermission("hr_payroll_user", "finalizePayroll"), false);
    assert.equal(hasPermission("hr_payroll_user", "manageSalaryConfig"), false);
    assert.equal(hasPermission("hr_payroll_user", "viewSalaryConfig"), true);
  });

  it("gives payroll manager finalize and salary CRUD", () => {
    assert.equal(hasPermission("hr_payroll_manager", "finalizePayroll"), true);
    assert.equal(hasPermission("hr_payroll_manager", "manageSalaryConfig"), true);
  });

  it("restricts user management to admin", () => {
    assert.equal(hasPermission("hr_payroll_manager", "createUsers"), false);
    assert.equal(hasPermission("admin", "createUsers"), true);
    assert.equal(canAccessAdminPath("admin", "/admin/users"), true);
    assert.equal(canAccessAdminPath("hr_manager", "/admin/users"), false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx tsx --test lib/permissions.test.ts
```

Expected: FAIL (`finalizePayroll` / `manageSalaryConfig` not defined, or payroll user lacks `managePeople`).

**Step 3: Write minimal implementation**

Update `Permission` union and `ROLE_PERMISSIONS` to the matrix in §3. Extend `canAccessAdminPath` for `/admin/people/contracts`, `/admin/people/schedules`, `/admin/people/leave/allocations`, `/admin/people/leave/types`, `/admin/hr/payroll/*`, `/admin/users`.

**Step 4: Run tests**

```bash
npx tsx --test lib/permissions.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/permissions.ts lib/permissions.test.ts
git commit -m "feat: align staff permissions with PeoplePay360 role matrix"
```

---

### Task 0.2: Prisma migration for HR/payroll domain

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_oxp_domain/migration.sql` via `npx prisma migrate dev --name oxp_domain`
- Modify: `prisma/seed.ts` (keep existing admin login working)

**Step 1: Write failing tests for helpers that the schema must support** (next tasks). For this task, add a schema compile check:

```bash
npx prisma validate
```

**Step 2:** Add models from §4. Change `EmployeeProfile.department` String → `departmentId`. Keep a data backfill in the migration: create departments from distinct existing strings, then drop the string column.

**Step 3:** `npx prisma migrate dev --name oxp_domain` then `npx prisma generate`.

**Step 4:** `npx prisma validate` PASS. `npm run db:seed` still logs in `admin@oddo.com`.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts
git commit -m "feat: add contracts, schedules, time-off, salary, and payrun schema"
```

Do not drop `Payroll` yet.

---

### Task 0.3: Sidebar IA skeleton + stub routes

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Create stub pages that render the standard page shell + “Coming in this phase” only if the real page is not next — **prefer empty list pages** that will be filled in the matching phase.

Create empty list shells (same page chrome) for:
- `app/admin/people/contracts/page.tsx`
- `app/admin/people/schedules/page.tsx`
- `app/admin/people/leave/allocations/page.tsx`
- `app/admin/people/leave/types/page.tsx`
- `app/admin/users/page.tsx` (admin only)

Payroll routes stay on `/admin/hr/payroll` until Phase 7 replaces the client.

**Commit:** `feat: map sidebar to Employees, Contracts, Schedules, Time Off, Payroll`

---

## Phase 1 — Departments and working schedules

### Task 1.1: Department CRUD (replace mock)

**Files:**
- Create: `lib/actions/departments.ts`
- Create: `lib/validations.ts` additions `createDepartmentSchema`
- Modify: `app/admin/people/department/page.tsx` (currently mock)

Wire list/create/rename. Employees later use `<select>` of departments.

**Commit:** `feat: persist departments instead of mock cards`

---

### Task 1.2: Schedule hours derivation (pure)

**Files:**
- Create: `lib/schedule-hours.ts`
- Create: `lib/schedule-hours.test.ts`

**Step 1: Failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lineHours, weeklyHours, daysPerWeek } from "./schedule-hours";

describe("working schedule math", () => {
  it("derives line hours from start, end, and break", () => {
    // 09:00–18:00 minus 60m break = 8h
    assert.equal(lineHours(9 * 60, 18 * 60, 60), 8);
  });

  it("sums weekly hours and unique days", () => {
    const lines = [
      { weekday: 1, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 2, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 3, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 4, startMin: 540, endMin: 1080, breakMin: 60 },
      { weekday: 5, startMin: 540, endMin: 1080, breakMin: 60 },
    ];
    assert.equal(weeklyHours(lines), 40);
    assert.equal(daysPerWeek(lines), 5);
  });
});
```

**Step 2:** Run `npx tsx --test lib/schedule-hours.test.ts` → FAIL.

**Step 3: Implementation**

```ts
export function lineHours(startMin: number, endMin: number, breakMin: number) {
  const raw = (endMin - startMin - breakMin) / 60;
  return Math.round(raw * 100) / 100;
}

export function weeklyHours(
  lines: { startMin: number; endMin: number; breakMin: number }[],
) {
  return Math.round(lines.reduce((sum, line) => sum + lineHours(line.startMin, line.endMin, line.breakMin), 0) * 100) / 100;
}

export function daysPerWeek(lines: { weekday: number }[]) {
  return new Set(lines.map((line) => line.weekday)).size;
}
```

**Step 4:** Test PASS.

**Step 5: Commit** `feat: derive weekly hours from schedule lines`

---

### Task 1.3: Schedule list + form UI

**Files:**
- Create: `lib/actions/schedules.ts`
- Create: `app/admin/people/schedules/schedules-client.tsx`
- Modify: `app/admin/people/schedules/page.tsx`

List columns: name, calendar type, days/week, hours/week, status. Form: add/remove days, start/end/break; show **Total Weekly Hours** as computed (read-only). Primary Save button zinc-900.

**Commit:** `feat: add working schedule list and form`

---

## Phase 2 — Employee hub

### Task 2.1: Employee form fields + update action

**Files:**
- Modify: `lib/actions/employees.ts` (`updateEmployeeAction`)
- Modify: `lib/validations.ts`
- Modify: `app/admin/people/employees/[id]/page.tsx`
- Create: `app/admin/people/employees/[id]/employee-form.tsx`

Form sections (tabs or stacked cards, not a new visual language):
- **Work:** department, manager, schedule, job title, company, work location, employee type, status
- **Private:** phone, personal email, address, bank account (needed for A/C missing)
- **HR settings:** join date

Smart buttons (counts only until child modules exist — wire hrefs with query `?employeeId=`):

`Contracts N` → `/admin/people/contracts?employeeId=`
`Attendance N` → `/admin/people/attendance?employeeId=`
`Time Off N` → `/admin/people/leave?employeeId=`
`Allocations N` → `/admin/people/leave/allocations?employeeId=`

**Commit:** `feat: make the employee record the HR hub with work and private fields`

---

### Task 2.2: Kanban + List toggle

**Files:**
- Modify: `app/admin/people/employees/employees-client.tsx`

Default view **Kanban** (Excalidraw). Cards: avatar initials, name, job, department, Active badge (emerald only on badge). Toggle Kanban | List. Both navigate to `/admin/people/employees/[id]`. Keep search + department/status filters.

**Commit:** `feat: add employee kanban and list views that share one form`

---

## Phase 3 — Contracts

### Task 3.1: Running-contract overlap (pure)

**Files:**
- Create: `lib/contract-period.ts`
- Create: `lib/contract-period.test.ts`

```ts
export type ContractWindow = {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  status: "running" | "expired";
};

export function windowsOverlap(a: ContractWindow, b: ContractWindow) {
  const aEnd = a.endDate ?? "9999-12-31";
  const bEnd = b.endDate ?? "9999-12-31";
  return a.startDate <= bEnd && b.startDate <= aEnd;
}

export function assertSingleRunning(next: ContractWindow, existing: ContractWindow[]) {
  if (next.status !== "running") return null;
  const clash = existing.find(
    (row) => row.id !== next.id && row.status === "running" && windowsOverlap(next, row),
  );
  return clash ? "An employee cannot have two Running contracts in the same period." : null;
}

export function contractForPeriod(
  contracts: ContractWindow[],
  periodStart: string,
  periodEnd: string,
) {
  const covering = contracts.filter((row) => {
    const end = row.endDate ?? "9999-12-31";
    return row.startDate <= periodEnd && end >= periodStart;
  });
  return covering.find((row) => row.status === "running") ?? covering[0] ?? null;
}
```

Tests: overlapping running rejected; expired+running allowed if dates do not overlap; payroll period picks the covering running contract.

**Commit:** `feat: enforce one running contract per period`

---

### Task 3.2: Contract list + form

**Files:**
- Create: `lib/actions/contracts.ts`
- Create: `app/admin/people/contracts/page.tsx` + client
- Create: `app/admin/people/contracts/[id]/page.tsx`

List: code, employee, start, end, wage/month, Running vs Expired badge. Form: dates, wage, department, position, salary structure (optional until Phase 6), schedule. Auto-expire when `endDate < today`. Generate `CON/YYYY/NNNN` like employee IDs.

Honor `?employeeId=` from smart button.

**Commit:** `feat: add employee contracts with running/expired history`

---

## Phase 4 — Attendance completeness

### Task 4.1: Worked hours, overtime, late vs schedule

**Files:**
- Create: `lib/attendance-metrics.ts`
- Create: `lib/attendance-metrics.test.ts`
- Modify: `lib/dates.ts` (stop using global 09:15 late once schedule exists; keep helper as fallback)

Rules:
- Worked hours = (checkout − checkin − schedule break for that weekday) in hours, 2 decimals
- Expected hours = schedule line hours for weekday; if no schedule, 8
- Overtime = max(0, worked − expected)
- Late = checkin minutes > schedule start + 0 grace (or 15 min grace)
- Missing checkout = checkin set, checkout null, date < today
- Absent = no row on a scheduled weekday and no approved leave

**Commit:** `feat: compute attendance hours and exceptions from the working schedule`

---

### Task 4.2: Attendance form + employee filter + persist derived fields

**Files:**
- Modify: `lib/actions/attendance.ts` (`upsertAttendanceAction` for HR)
- Modify: `app/admin/people/attendance/`
- Create: `app/admin/people/attendance/[id]/page.tsx`

List columns: employee, date, check in, check out, worked hours, status. Authorized users (`managePeople`) can open a form and correct punches; set `manualEdit = true`. Recompute hours on save.

**Commit:** `feat: add attendance form with manual corrections and worked hours`

---

### Task 4.3: Navbar attendance widget

**Files:**
- Create: `components/layout/attendance-widget.tsx`
- Modify: `components/layout/navbar.tsx`
- Reuse: `lib/actions/attendance.ts` clock in/out

Popup: if no open session → Check In; else Check Out + elapsed `HhMm`. Status dot green when checked in, zinc/red when not. All authenticated users (including staff in admin app).

**Commit:** `feat: add navbar check-in/out popup with elapsed time`

---

## Phase 5 — Time Off (OXP model)

### Task 5.1: Allocation remaining + request consumption (pure)

**Files:**
- Create: `lib/time-off-balance.ts`
- Create: `lib/time-off-balance.test.ts`

```ts
export function remaining(allocated: number, taken: number) {
  return Math.round((allocated - taken) * 100) / 100;
}

export function canSubmitRequest(input: {
  requiresAllocation: boolean;
  remaining: number;
  duration: number;
  allocationStatus: "draft" | "approved" | "refused";
}) {
  if (!input.requiresAllocation) return null;
  if (input.allocationStatus !== "approved") {
    return "This leave type needs an approved allocation before you can request time off.";
  }
  if (input.duration > input.remaining) {
    return "Not enough remaining balance on the selected allocation.";
  }
  return null;
}

export function takenAfterApproval(taken: number, duration: number) {
  return Math.round((taken + duration) * 100) / 100;
}
```

Also keep existing overlap tests in `lib/leave-rules.ts`; point `type` at type id later.

**Commit:** `feat: consume approved allocations when time off is approved`

---

### Task 5.2: Time Off Types CRUD

**Files:**
- Create: `lib/actions/time-off-types.ts`
- Create: `app/admin/people/leave/types/page.tsx`

List: name, unit, allocation required, approval. Form: name, unit, requires allocation, approver, color (status token only), payroll note. Seed: Paid Time Off (days, required, manager), Sick Leave (days, no allocation, manager), Unpaid (days, no), Comp Off (days, required).

**Commit:** `feat: add configurable time off types`

---

### Task 5.3: Allocations list/form + approve

**Files:**
- Create: `lib/actions/allocations.ts`
- Create: `app/admin/people/leave/allocations/page.tsx`

List: employee, type, allocated, taken, remaining, validity year, status. Approving an allocation makes it usable. Remaining is derived in the mapper (`allocated - taken`), not a third source of truth (store taken only).

**Commit:** `feat: add leave allocations with allocated/taken/remaining`

---

### Task 5.4: Rewrite requests to use types + allocations

**Files:**
- Modify: `lib/actions/leave.ts`
- Modify: `app/admin/people/leave/`
- Modify: `app/employee/leave/`
- Remove use of `LeaveType` enum and `paidLeaveBalance` after cutover

Request form: type, dates, duration (derived from unit), allocation picker (required types), reason. Actions: Approve / Refuse with comment. On approve: increment `allocation.taken` when type requires allocation; create/mark attendance `leave` for those dates (already exists).

Sidebar Time Off children only — remove extra in-page nav buttons that duplicate Requests/Allocations/Types.

**Commit:** `feat: drive time off requests from types and allocations`

---

## Phase 6 — Salary structures and rule engine

This is the core of the problem statement. Rules must compute payslip lines. No Python runtime.

### Task 6.1: Ordered salary computation (pure)

**Files:**
- Create: `lib/payroll/compute.ts`
- Create: `lib/payroll/compute.test.ts`

Engine input:

```ts
export type ComputeRule = {
  name: string;
  code: string;
  category: "basic" | "allowance" | "gross" | "deduction" | "net" | "contribution";
  sequence: number;
  computation: "fixed" | "percent_of_wage" | "percent_of_basic" | "percent_of_gross" | "percent_of_category" | "formula";
  amount?: number;
  percentage?: number;
  percentBaseCode?: string;
  formula?: string;
};

export type ComputeContext = {
  wage: number;
  workedDays: number;
  scheduledDays: number;
  unpaidLeaveDays: number;
};

export type ComputeLine = {
  name: string;
  code: string;
  category: ComputeRule["category"];
  amount: number;
};
```

Processing:
1. Sort by `sequence`.
2. Maintain `categories` totals and `byCode` map.
3. `fixed` → `amount`.
4. `percent_of_wage` → `wage * percentage / 100`.
5. `percent_of_basic` → `categories.basic * percentage / 100`.
6. `percent_of_gross` → `categories.gross * percentage / 100`.
7. `percent_of_category` → `byCode[percentBaseCode] * percentage / 100`.
8. `formula` → evaluate **only** with `evaluateFormula(formula, { wage, workedDays, scheduledDays, unpaidLeaveDays, categories, byCode })`.
9. `gross` category rule should typically be formula `categories.basic + categories.allowance` (seed it; do not hardcode in the engine).
10. `net` = gross − deductions − contributions (seed a NET rule).
11. Round every line to 2 decimals.

**Formula sandbox:** whitelist identifiers `wage`, `workedDays`, `scheduledDays`, `unpaidLeaveDays`, `categories.basic`, `categories.allowance`, `categories.gross`, `categories.deduction`, `byCode.CODE`. Parse with a tiny recursive-descent or `new Function` **only after** validating the string matches `/^[0-9+\-*/(). _a-zA-Z\[\]'"]+$/` and contains no `require`, `process`, `window`, etc. Prefer an explicit evaluator over `eval`.

**Tests (must include the Excalidraw example):**

| Sequence | Code | Method | Result |
| --- | --- | --- | --- |
| 1 | BASIC | percent_of_wage 100% or fixed 50000 | 50000 |
| 10 | HRA | percent_of_basic 40% | 20000 |
| 20 | STD | fixed 10000 | 10000 |
| 50 | GROSS | formula basic+allowance | 80000 |
| 60 | PF | percent_of_basic 6% or fixed 3000 | 3000 |
| 70 | PT | fixed 2000 | 2000 |
| 100 | NET | formula gross − deduction | 75000 |

Also test unpaid leave: `BASIC = wage * (workedDays / scheduledDays)`.

**Commit:** `feat: add sequenced salary-rule computation engine`

---

### Task 6.2: Structure + rule list/form

**Files:**
- Create: `lib/actions/salary.ts`
- Create: `app/admin/hr/payroll/structures/`
- Create: `app/admin/hr/payroll/rules/`

HR Payroll User: read-only (no Save). Manager/Admin: full CRUD. Structure form lists rules ordered by sequence. Rule form shows computation note from Excalidraw (fixed / % of wage or basic or gross / formula).

Seed “Regular Salary” with the table above.

**Commit:** `feat: configure salary structures and rules that the engine will run`

---

## Phase 7 — Payruns, payslips, PDF, email

### Task 7.1: Payrun warnings helper (pure)

**Files:**
- Create: `lib/payroll/warnings.ts`
- Create: `lib/payroll/warnings.test.ts`

```ts
export function payslipWarning(input: {
  bankAccount: string | null | undefined;
  hasContract: boolean;
  duplicateInOtherPayrun: boolean;
}) {
  if (!input.hasContract) return "No contract for this period";
  if (!input.bankAccount) return "A/C missing";
  if (input.duplicateInOtherPayrun) return "Duplicate";
  return null;
}
```

**Commit:** `feat: surface payrun warnings for missing bank, contract, and duplicates`

---

### Task 7.2: Two-step create wizard (no insert until Create Payrun)

**Files:**
- Create: `lib/actions/payruns.ts`
- Replace: `app/admin/hr/payroll/page.tsx` + new `payrun-wizard.tsx`
- Create: `app/admin/hr/payroll/[id]/page.tsx`

Wizard:
1. Modal/page: employee type (all / full_time / intern / contractor), salary structure, period start/end. **Continue does not write to DB.**
2. Table of eligible employees (active, matching type, have covering contract). Multi-select.
3. **Create Payrun** inserts `Payrun` + `Payslip` rows (`draft`, empty lines) for selected employees only, then routes to `/admin/hr/payroll/[id]`.

Keep old `upsertPayroll` unused; hide the month editor.

**Commit:** `feat: create payruns only after structure, period, and employee selection`

---

### Task 7.3: Compute → Validate → Mark Paid

**Files:**
- Modify: `lib/actions/payruns.ts`
- Modify: `app/admin/hr/payroll/[id]/payrun-form.tsx`

Buttons: COMPUTE (editPayroll), VALIDATE (finalizePayroll), MARK PAID (finalizePayroll), SEND PAYSLIPS (editPayroll, after paid or validated — Excalidraw allows send from payrun; send after Validate is enough).

Compute:
- Load structure rules
- `contractForPeriod`
- `workedDays` = scheduled weekdays in period minus unpaid leave days minus absences (document the formula in code comments)
- Run `computePayslip`
- Store lines, gross, net, warning, status `computed`

Validate: all slips computed, block if any “No contract” warning (A/C missing is warning but allowed). Status `validated`.

Mark paid: status `paid`. Immutable history (no delete of paid runs; no recompute unless manager resets to draft — skip reset for YAGNI).

**Commit:** `feat: compute, validate, and mark payruns paid from contract and salary rules`

---

### Task 7.4: Payslip detail + PDF

**Files:**
- Create: `app/admin/hr/payroll/payslips/page.tsx`
- Create: `app/admin/hr/payroll/payslips/[id]/page.tsx`
- Create: `lib/payroll/payslip-pdf.tsx` or HTML route `app/admin/hr/payroll/payslips/[id]/print/page.tsx`

Use a print-friendly HTML page + `window.print()` **or** `@react-pdf/pdf` only if you add the dependency. Prefer a print stylesheet (no new design system): employee, period, structure, worked days, line table, net. Action: PRINT PAYSLIP.

**Commit:** `feat: show payslip computation and printable PDF`

---

### Task 7.5: Send Payslips email

**Files:**
- Modify: `lib/mail.ts` (`sendPayslipEmail`)
- Modify: `lib/actions/payruns.ts` `sendPayslipsAction`

Reuse SMTP. Attach PDF or include HTML table. Bulk from payrun. Skip employees without email. Toast counts sent vs failed.

**Commit:** `feat: email payslips to employees from a payrun`

---

### Task 7.6: Remove old payroll editor

**Files:**
- Delete usage of `model Payroll` from UI/actions
- Optional migration to drop `payroll` table after one successful payrun on seed

**Commit:** `refactor: replace month payroll rows with payruns and payslips`

---

## Phase 8 — Live payroll dashboard

### Task 8.1: Aggregation queries

**Files:**
- Create: `lib/actions/payroll-dashboard.ts`
- Create: `lib/payroll/dashboard-metrics.test.ts` for pure rollups if you extract them

Filters: `periodStart`, `periodEnd`, `departmentId`, `employeeType`.

KPIs from real tables:
- Total net salary **paid** in period
- Payslips generated; paid vs pending
- Average net
- Approved time-off days in period
- Attendance health = present / (present + absent + missing checkout) for period

Charts: salary by department (zinc bars `#E4E4E7` → `#18181B`); monthly net trend from historical paid payruns.

Alerts list: missing bank, duplicates, drafts, contracts ending this month.

Replace Open Position mock on `components/section/dashboard.tsx` **or** split: `/admin` becomes this dashboard (PDF: dashboard lives in Payroll but HR Manager also needs an ops view). **Decision:** one `/admin` dashboard; HR Manager sees attendance/time-off/headcount KPIs and empty salary cards with “No payroll access”; payroll roles see all cards.

**Commit:** `feat: build payroll dashboard from live HR and payslip data`

---

### Task 8.2: Dashboard UI + filters that work

**Files:**
- Modify: `components/section/dashboard.tsx`
- Modify: `app/admin/page.tsx`

Period / Department / Employee Type selects must refetch (searchParams or Server Action). Charts grayscale only. KPI cards: no heavy shadows.

**Commit:** `feat: filter dashboard by period, department, and employee type`

---

## Phase 9 — User management and leftover access

### Task 9.1: Admin User Management (link to existing employee)

**Files:**
- Create: `lib/actions/users.ts`
- Create: `app/admin/users/page.tsx`

List: name, email, role, linked employee, active. Create/Edit: pick **existing** employee (or create employee first in People), work email, role, account status. Do not allow a user to change their own role. Keep employee create as “create employee master”; optionally stop auto-creating login until admin links a user — **Decision:** keep current create-employee-with-login for speed, and add User Management to edit role / disable account.

Forgot password: only if time; Better Auth already has flows — wire `/forgot-password` last.

**Commit:** `feat: add admin user management linked to employee records`

---

### Task 9.2: Employee self-service completeness

**Files:**
- Modify: `app/employee/profile/page.tsx` — show schedule, manager, running contract wage (read-only), allocations remaining
- Modify: `app/employee/leave/` — types + allocations
- Optional: `app/employee/payroll/page.tsx` — own payslips after send (not admin). PDF says no payroll **administration**; viewing own slip is OK.

**Commit:** `feat: show contract, schedule, and leave balances on employee self-service`

---

## Phase 10 — Seed, demo, extras, roadmap

### Task 10.1: Representative seed

**Files:**
- Modify: `prisma/seed.ts`

Create:
- Departments Finance, Engineering, HR
- Schedule 40 Hours / Week
- Employees Aarav, Sara, John, Neha (names from Excalidraw) plus existing admin
- Running + expired contracts with wages
- Time off types + 2026 allocations
- Regular Salary structure/rules
- Sample attendance (missing checkout, late, present)
- One paid January payrun and one draft March payrun with a warning

Keep `admin@oddo.com` / `admin@oddo@1234`.

**Commit:** `chore: seed a full employee-to-payslip demo dataset`

---

### Task 10.2: Demo script + future roadmap

**Files:**
- Create: `docs/demo-walkthrough.md` — 5 minutes:
  1. Employee hub → contract → attendance widget → time off allocation → request → approve → balance
  2. Structure/rules → new payrun wizard → compute → warning → validate → PDF → send
- Create: `docs/demo-roadmap.md` — multi-role, SSO, forgot password, recruitment, performance, AI, notifications, Python-like rules, India statutory (PF/ESI/PT) as real law tables

Leave Recruitment / Performance / Analytics / Notifications as mock.

**Commit:** `docs: add hackathon demo script and future roadmap`

---

## 7. Test plan (whole product)

Automated (run after every phase):

```bash
npm test
npx prisma validate
npm run build
```

Browser (required before calling a phase done), login `admin@oddo.com` / `admin@oddo@1234`:

1. HR Manager cannot open Payroll; can approve leave and edit employees.
2. HR Payroll User can create a payrun and compute, cannot Mark Paid, cannot edit salary rules.
3. Employee kanban card and list row open the same form; smart buttons filter children.
4. Two running overlapping contracts are rejected.
5. Schedule weekly hours update when a line changes.
6. Widget check-in turns green; check-out writes worked hours.
7. Allocation 20, request 3 approved → remaining 17; request without allocation on required type fails.
8. Payrun Continue does not create a row; Create Payrun creates only selected employees.
9. Compute matches seed Regular Salary (50000 / 20000 / 10000 / 80000 / 3000 / 2000 / 75000) for Aarav if wage and rules match.
10. Missing bank shows “A/C missing” before validate.
11. Print payslip and Send Payslips (check SMTP or toast fallback).
12. Dashboard numbers change when period filter changes; Open Position mock gone.
13. Employee cannot open `/admin/hr/payroll`.

---

## 8. Out of scope until roadmap

- Self-service public signup / email verification of signup
- SSO, invitations, forgot password (unless Phase 9 leftover)
- True multi-role arrays
- Executing real Python salary code
- Recruitment, performance, AI analytics, live notifications
- Statutory India payroll as legally complete PF/ESI (seed demo lines only)
- Replacing sidebar with Excalidraw’s top navbar
- Docker (local Postgres already in use)

---

## 9. Suggested git cadence

One commit per task above (already listed). Do not combine schema + payroll UI in one commit. Do not commit `.env` / `.env.local`.
