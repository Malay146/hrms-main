# Evaluation prep: database + UI

Oral-exam answers for PeoplePay360. Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). Column catalog: [`database-schema.md`](./database-schema.md). Backend folders: [`BACKEND.md`](./BACKEND.md).

**How to answer every FK question**

1. Name the **child table** (where the column lives).
2. Name the **column**.
3. Name the **parent table + PK**.
4. Say **ON DELETE** (Cascade / Restrict).
5. Point at the **UI screen** and the **action file** that reads or writes it.

Example: “The department foreign key is on `employee_profile.departmentId` → `department.id`. It is **Restrict**, so you cannot delete a department that still has employees. The Employees form writes it via `lib/actions/people/employees.ts`.”

Prisma default when `onDelete` is omitted is **Restrict** (Postgres will refuse the delete).

---

## 0. Folder structure (after the recent pull)

The product has **no separate Express API**. UI → Server Actions → Prisma → PostgreSQL.

```
app/admin/**              UI routes (People, Payroll, Users, AI)
app/employee/**           Self-service UI
lib/db.ts                 Prisma client
lib/auth/                 Better Auth, session, permissions
lib/shared/               types, Zod, mappers, dates, mail
lib/people/               domain helpers (no SQL)
lib/payroll/              salary engine (no SQL)
lib/ai/                   metrics / sanitize / copilot
lib/actions/
  people/                 People server actions
  payroll/                Payroll server actions
  auth.ts, users.ts, dashboard.ts, profile.ts, ai.ts
prisma/                   schema, migrations, seed
```

**UI → action (sidebar order)**

| Screen | Route | Action file |
| --- | --- | --- |
| Login | `/login` | `lib/actions/auth.ts` |
| Dashboard | `/admin` | `lib/actions/dashboard.ts`, `lib/actions/payroll/payroll-dashboard.ts` |
| Employees | `/admin/people/employees` | `lib/actions/people/employees.ts` |
| Contracts | `/admin/people/contracts` | `lib/actions/people/contracts.ts` |
| Working Schedules | `/admin/people/schedules` | `lib/actions/people/schedules.ts` |
| Departments | `/admin/people/department` | `lib/actions/people/departments.ts` |
| Attendance | `/admin/people/attendance` | `lib/actions/people/attendance.ts` |
| Time Off Requests | `/admin/people/leave` | `lib/actions/people/leave.ts` |
| Allocations | `/admin/people/leave/allocations` | `lib/actions/people/allocations.ts` |
| Types | `/admin/people/leave/types` | `lib/actions/people/time-off-types.ts` |
| Payruns | `/admin/hr/payroll` | `lib/actions/payroll/payruns.ts` |
| Payslips | `/admin/hr/payroll/payslips` | `lib/actions/payroll/payruns.ts` |
| Structures | `/admin/hr/payroll/structures` | `lib/actions/payroll/salary.ts` |
| Rules | `/admin/hr/payroll/rules` | `lib/actions/payroll/salary.ts` |
| Users | `/admin/users` | `lib/actions/users.ts` |
| AI Analytics | `/admin/analytics` | `lib/actions/ai.ts` |
| My Profile / Leave / Payroll | `/employee/**` | `profile.ts`, `people/leave.ts`, `payroll/payruns.ts` |

**Helpers they may ask for instead of tables**

| Question | File |
| --- | --- |
| Who can open this route? | `lib/auth/permissions.ts` |
| Current user + profile.department.name | `lib/auth/session.ts` |
| Employee code `ODOO-2026-008` | `lib/people/employee-id.ts` |
| Two Running contracts | `lib/people/contract-period.ts` |
| Schedule weekly hours | `lib/people/schedule-hours.ts` |
| Late / overtime | `lib/people/attendance-metrics.ts` |
| Leave overlap | `lib/people/leave-rules.ts` |
| Allocation remaining | `lib/people/time-off-balance.ts` |
| Map `type.code` → paid/sick/unpaid | `lib/shared/mappers.ts` (`leaveTypeFromCode`) |
| Kolkata dates | `lib/shared/dates.ts` |
| BASIC → NET 75000 | `lib/payroll/compute.ts` |
| Missing bank / no contract | `lib/payroll/warnings.ts` |

---

## 0.1 Thirty-second architecture

- **PostgreSQL + Prisma 7.** Physical table names come from `@@map("snake_case")`.
- **Tenant:** one `organization` (seeded Odoo / slug `ODOO`).
- **Two identities:**
  - `user` = login (Better Auth). Attendance and leave hang off **`user.id`**.
  - `employee_profile` = HR master (1:1 with `user`). Contracts, allocations, payslips hang off **`employee_profile.id`**.
- **Do not mix those IDs in an answer.** `leave_request.userId` is not `employee_profile.id`.
- **Payroll is not a month row anymore.** Live payroll is `salary_structure` → `salary_rule` → `payrun` → `payslip` → `payslip_line`. Table `payroll` is **legacy**.

```
organization
  ├── department
  ├── working_schedule → working_schedule_line
  ├── employee_profile  ←── user (1:1)
  │     ├── managerId (self-FK)
  │     ├── contract
  │     ├── time_off_allocation
  │     └── payslip
  ├── time_off_type → time_off_allocation / leave_request
  ├── salary_structure → salary_rule / payrun
  └── ai_insight

user
  ├── session, account
  ├── attendance          (unique userId+date)
  ├── leave_request       (typeId, optional allocationId)
  └── payroll             (legacy)
```

---

## 1. Master FK cheat sheet

Ordered the way an evaluator will poke: “where is the FK for X?”

| They say… | You say: column | Points to | On delete | Written from UI |
| --- | --- | --- | --- | --- |
| Session / login cookie | `session.userId` | `user.id` | Cascade | Better Auth (not a form) |
| Password hash | `account.userId` | `user.id` | Cascade | Users / seed. Unique `(issuer, accountId)` |
| Employee belongs to a login | `employee_profile.userId` | `user.id` | Cascade | Users create + Employees. **Unique (1:1)** |
| Employee belongs to company | `employee_profile.organizationId` | `organization.id` | Cascade | Seed / create user |
| Employee department | `employee_profile.departmentId` | `department.id` | **Restrict** | Employees form. **Required** |
| Manager | `employee_profile.managerId` | `employee_profile.id` | Restrict | Employees form. Self-relation `"EmployeeManager"` |
| Default schedule on employee | `employee_profile.scheduleId` | `working_schedule.id` | Restrict | Employees form. Optional |
| Department belongs to org | `department.organizationId` | `organization.id` | Cascade | Departments. Unique `(organizationId, code)` |
| Schedule belongs to org | `working_schedule.organizationId` | `organization.id` | Cascade | Working Schedules |
| Day line of a schedule | `working_schedule_line.scheduleId` | `working_schedule.id` | Cascade | Working Schedules form |
| Contract belongs to employee | `contract.employeeId` | `employee_profile.id` | Cascade | Contracts |
| Contract department | `contract.departmentId` | `department.id` | Restrict | Contracts. Optional |
| Contract schedule | `contract.scheduleId` | `working_schedule.id` | Restrict | Contracts. Optional |
| Contract salary structure | `contract.salaryStructureId` | `salary_structure.id` | Restrict | Contracts. Optional |
| Time-off type belongs to org | `time_off_type.organizationId` | `organization.id` | Cascade | Types. Unique `(organizationId, code)` |
| Allocation employee | `time_off_allocation.employeeId` | `employee_profile.id` | Cascade | Allocations |
| Allocation type | `time_off_allocation.typeId` | `time_off_type.id` | Cascade | Allocations |
| Leave who requested | `leave_request.userId` | **`user.id`** | Cascade | Time Off (employee + admin) |
| Leave type | `leave_request.typeId` | `time_off_type.id` | Restrict | Time Off. Replaced old enum `type` |
| Leave consumes allocation | `leave_request.allocationId` | `time_off_allocation.id` | Restrict | Time Off. Optional |
| Attendance punch | `attendance.userId` | **`user.id`** | Cascade | Navbar widget + Attendance. Unique `(userId, date)` |
| Structure belongs to org | `salary_structure.organizationId` | `organization.id` | Cascade | Structures |
| Rule belongs to structure | `salary_rule.structureId` | `salary_structure.id` | Cascade | Rules |
| Payrun belongs to org | `payrun.organizationId` | `organization.id` | Cascade | Payruns |
| Payrun uses structure | `payrun.structureId` | `salary_structure.id` | **Restrict** | Payruns wizard |
| Payslip belongs to payrun | `payslip.payrunId` | `payrun.id` | Cascade | Created with payrun |
| Payslip employee | `payslip.employeeId` | `employee_profile.id` | Cascade | Payrun employee picker. Unique `(payrunId, employeeId)` |
| Payslip period contract | `payslip.contractId` | `contract.id` | Restrict | Optional; compute can leave it null |
| Payslip line | `payslip_line.payslipId` | `payslip.id` | Cascade | Compute rewrite |
| Line’s rule snapshot | `payslip_line.ruleId` | **not an FK** | — | Copied at compute so history survives rule edits |
| AI cache | `ai_insight.organizationId` | `organization.id` | Cascade | AI Analytics generate |
| Legacy month payroll | `payroll.userId` | `user.id` | Cascade | Seed / old list. Unique `(userId, month)` |

---

## 2. Q&A by UI (sidebar order)

### 2.1 Login / Users — `/login`, `/admin/users`

**Q. Where is the foreign key for a session?**  
`session.userId` → `user.id`, **ON DELETE CASCADE**. If the user is deleted, sessions go with them. Not shown as a UI field.

**Q. Where is the password stored? Is it a FK?**  
No FK for the password. Hash is `account.password`. The FK is `account.userId` → `user.id`, Cascade. Unique is `(issuer, accountId)` — `issuer` defaults to `local:credential` so Better Auth 1.7 can log in.

**Q. Users screen: what tables do you write?**  
Creating a managed user writes **`user` + `account` + `employee_profile`**. Profile FKs: `userId`, `organizationId`, `departmentId` (required).

**Q. Why are there two role columns?**  
`user.role` is **TEXT** (Better Auth). `employee_profile.role` is the Postgres **`Role` enum**. App code must keep them in sync. Permissions read the **user** role (`lib/auth/permissions.ts`).

**Q. Can an HR Manager open Users?**  
No. `createUsers` is **admin only**. Path `/admin/users` is gated in `canAccessAdminPath` (`lib/auth/permissions.ts`). Writes: `lib/actions/users.ts`.

---

### 2.2 Dashboard — `/admin`

**Q. Which tables feed the admin dashboard?**  
`employee_profile` (headcount, department pie via `department.name`), `attendance` (today / week), `leave_request` (pending + on leave today). Payroll KPIs additionally use `payslip` / `payrun` when the role has `viewPayrollAll`.

**Q. Where is the department FK used on the dashboard pie?**  
Not a second FK. Profiles already have `departmentId`. Query includes `department: { select: { name: true } }` (`lib/actions/dashboard.ts`). The old string column `employee_profile.department` was **dropped** in migration `20260905150000_oxp_domain`.

**Q. Why can payroll users see People KPIs but HR Manager cannot see net paid?**  
Same page, different permission. `getPayrollDashboard` (`lib/actions/payroll/payroll-dashboard.ts`) still runs, but salary totals are empty unless `viewPayrollAll`. That is application RBAC, not a database constraint.

---

### 2.3 People → Employees — `/admin/people/employees`

**Q. Where is the FK for department on an employee?**  
`employee_profile.departmentId` → `department.id`. **Required. Restrict.** You cannot delete Engineering if Aarav is still in it. Written by `lib/actions/people/employees.ts`.

**Q. Where is the manager FK?**  
`employee_profile.managerId` → `employee_profile.id`. Named relation `"EmployeeManager"`. Optional. Reverse side is `reports[]`. Restrict, so you cannot delete a manager who still has reports unless you clear `managerId` first.

**Q. Where is the schedule FK on the employee?**  
`employee_profile.scheduleId` → `working_schedule.id`. Optional. Restrict.

**Q. Is `employeeId` like `ODOO-2026-008` a foreign key?**  
No. It is a **unique business code** on `employee_profile.employeeId`. Generated in `lib/people/employee-id.ts` from org slug + year + sequence.

**Q. Employee vs user — which id do contracts use?**  
Contracts use **`employee_profile.id`**, not `user.id`.

**Q. Where is wage stored for an employee?**  
`employee_profile.wage` (`DECIMAL(12,2)`, nullable). This is the **stub wage** payroll uses until a covering running contract exists. Contract has its own `contract.wage` (required). Two different columns; say that out loud.

---

### 2.4 People → Contracts — `/admin/people/contracts`

**Q. List every FK on `contract`.**

| Column | To | Delete |
| --- | --- | --- |
| `employeeId` | `employee_profile.id` | Cascade (delete employee → contracts go) |
| `departmentId` | `department.id` | Restrict, **nullable** |
| `scheduleId` | `working_schedule.id` | Restrict, nullable |
| `salaryStructureId` | `salary_structure.id` | Restrict, nullable |

**Q. Is “one running contract per period” a database unique index?**  
**No.** It is application logic in `lib/people/contract-period.ts` (`assertSingleRunning`), called from `lib/actions/people/contracts.ts`. The DB only has unique `contract.code`. If they ask “why not a unique index?”, say: running vs expired and date windows are not a single unique column; we validate in the action.

**Q. Does a payslip have to point at a contract?**  
`payslip.contractId` is **optional**. Missing covering contract produces warning `"No contract for this period"` (`lib/payroll/warnings.ts`) and blocks **Validate**, not compute.

---

### 2.5 People → Working Schedules — `/admin/people/schedules`

**Q. Where is the FK for a Monday 9–6 line?**  
`working_schedule_line.scheduleId` → `working_schedule.id`, **Cascade**. Delete the schedule, lines go with it.

**Q. Are weekly hours a FK?**  
No. `hoursPerWeek` and `daysPerWeek` are **stored derived totals**. Math is `lib/people/schedule-hours.ts`. Lines store `startMin`, `endMin`, `breakMin`, `hours`. CRUD is `lib/actions/people/schedules.ts`.

**Q. Who references a schedule besides lines?**  
Optional FKs: `employee_profile.scheduleId` and `contract.scheduleId`. Both Restrict, so you should not delete a schedule still assigned to people/contracts.

---

### 2.6 People → Departments — `/admin/people/department`

**Q. Where is the org FK?**  
`department.organizationId` → `organization.id`, Cascade.

**Q. Can two orgs reuse code `ENG`?**  
Yes. Unique is **`(organizationId, code)`**, not `code` globally.

**Q. Why can’t I delete a department from the UI / DB?**  
Employees **must** have `departmentId` (NOT NULL) with Restrict. Contracts may also point at it. Clear or reassign those FKs first.

**Q. What was the old design?**  
`employee_profile.department` was a **string**. Malay’s oxp migration created `department` rows from distinct strings, set `departmentId`, then **dropped** the string column.

---

### 2.7 People → Attendance — `/admin/people/attendance` (+ navbar widget)

**Q. Where is the attendance foreign key?**  
`attendance.userId` → **`user.id`**, Cascade. Not `employee_profile.id`.

**Q. What uniqueness did you implement?**  
`@@unique([userId, date])`. One punch row per person per calendar day. Second check-in the same day updates the same row (or is rejected), it does not insert a second row.

**Q. Are worked hours a FK to the schedule?**  
No. `workedHours` / `overtimeHours` are stored numbers derived from check-in/out vs schedule minutes (`lib/people/attendance-metrics.ts`). There is **no** `attendance.scheduleId`. Punches go through `lib/actions/people/attendance.ts`.

**Q. What does `manualEdit` mean?**  
Boolean on `attendance`. True after HR corrects the row on the attendance detail form. Not a relation.

---

### 2.8 People → Time Off Types — `/admin/people/leave/types`

**Q. Where is the FK for a type?**  
`time_off_type.organizationId` → `organization.id`, Cascade. Unique `(organizationId, code)` with codes like `paid`, `sick`, `unpaid`, `comp_off`.

**Q. Is leave type still an enum on the request?**  
**No.** Old `LeaveType` enum on `leave_request.type` was dropped. Now `leave_request.typeId` → `time_off_type.id` (**Restrict**). UI maps `code` back to labels via `leaveTypeFromCode` (`lib/shared/mappers.ts`).

**Q. What does `requiresAllocation` do?**  
Not a FK. Flag on the type. If true, submit is blocked until there is an **approved** allocation (`lib/people/time-off-balance.ts`). Unpaid-style types can skip allocation.

---

### 2.9 People → Allocations — `/admin/people/leave/allocations`

**Q. Where are the allocation FKs?**  
- `time_off_allocation.employeeId` → `employee_profile.id` **Cascade**  
- `time_off_allocation.typeId` → `time_off_type.id` **Cascade**

**Q. Do you store remaining balance?**  
**No third column.** Remaining = `allocated - taken`. `taken` increments on approve (`takenAfterApproval`).

**Q. Draft vs approved — is that a FK?**  
Enum `AllocationStatus`: `draft` / `approved` / `refused`. Only **approved** grants usable balance.

---

### 2.10 People → Time Off Requests — `/admin/people/leave` and `/employee/leave`

**Q. Where is the FK for “who asked”?**  
`leave_request.userId` → **`user.id`**, Cascade. Join to profile with `user.profile` when you need department/name.

**Q. Where is the FK for the leave type?**  
`leave_request.typeId` → `time_off_type.id`, **Restrict**. Cannot delete a type that is still on requests.

**Q. Where is the FK that consumes an allocation?**  
`leave_request.allocationId` → `time_off_allocation.id`, optional, Restrict. Set when the type requires allocation.

**Q. Is overlapping leave a unique constraint?**  
**No.** Overlap is `lib/people/leave-rules.ts` / `lib/actions/people/leave.ts`. Indexes `(startDate, endDate)` and `(userId, status)` are for lookup, not exclusion.

**Q. Summarize button — extra table?**  
Reads the same `leave_request` + `time_off_type.code` + peer requests in the same `departmentId`. Optional LLM cache is `ai_insight`, not a leave table.

---

### 2.11 Payroll → Structures / Rules — `/admin/hr/payroll/structures`, `/rules`

**Q. Where is the FK for a rule?**  
`salary_rule.structureId` → `salary_structure.id`, **Cascade**. Delete structure → rules go.

**Q. Is `percentBaseCode` a foreign key?**  
**No.** It is a **string code** of an earlier rule (e.g. BASIC). The engine looks it up in memory while sequencing (`lib/payroll/compute.ts`, from `lib/actions/payroll/payruns.ts`). No SQL FK.

**Q. Who can write structures?**  
`manageSalaryConfig`: admin + payroll **manager**. Payroll **user** has `viewSalaryConfig` only.

**Q. Regular Salary — is it a table?**  
No. It is a **seeded row** of `salary_structure` plus `salary_rule` rows from `lib/payroll/regular-salary.ts`. Demo: wage 50000 → net **75000**.

---

### 2.12 Payroll → Payruns — `/admin/hr/payroll`

**Q. Where is the FK for the structure on a payrun?**  
`payrun.structureId` → `salary_structure.id`, **Restrict**. You should not delete a structure used by historical payruns.

**Q. Org FK?**  
`payrun.organizationId` → `organization.id`, Cascade.

**Q. Is the employee list a join table?**  
**No separate payrun_employee table.** Selecting employees **creates `payslip` rows** with `payrunId` + `employeeId`. The wizard’s “Create Payrun” is the insert; Continue does not write.

**Q. Statuses?**  
Shared enums `PayrunStatus` / `PayslipStatus`: `draft` → `computed` → `validated` → `paid`. Validate/Mark paid require `finalizePayroll` (manager/admin). Compute is `editPayroll`.

**Q. Duplicate payslip warning — which unique key?**  
`@@unique([payrunId, employeeId])` on `payslip` blocks the same person twice in **one** payrun. Cross-payrun same period is an **app warning**, not a unique index.

---

### 2.13 Payroll → Payslips — `/admin/hr/payroll/payslips`

**Q. List payslip FKs.**

| Column | To | Delete |
| --- | --- | --- |
| `payrunId` | `payrun.id` | Cascade |
| `employeeId` | `employee_profile.id` | Cascade |
| `contractId` | `contract.id` | Restrict, optional |

**Q. Where is the FK for a BASIC 50000 line?**  
`payslip_line.payslipId` → `payslip.id`, Cascade. Recompute **deletes lines then recreates**.

**Q. Is `payslip_line.ruleId` a foreign key?**  
**No `@relation`.** Optional string snapshot of the rule id at compute time. If they ask “why?”, say: historical payslips must not break when HR edits or deletes a rule. Amounts live on the line; `code` / `category` are copied too.

**Q. Employee self-service payslips?**  
`/employee/payroll` reads `payslip` where `employeeId` = current profile and status in `validated` / `paid`. Same FKs; permission is ownership, not `viewPayrollAll`.

**Q. `sentAt`?**  
Timestamp on `payslip`, not a FK. Set when email send succeeds.

---

### 2.14 HR Recruitment / Performance

**Q. Which tables?**  
**None yet.** Sidebar stubs. Do not invent FKs. Say: “Not in `schema.prisma`. Placeholders only.”

---

### 2.15 AI Analytics — `/admin/analytics`

**Q. Where is the FK?**  
`ai_insight.organizationId` → `organization.id`, Cascade. Index `(organizationId, generatedAt)`.

**Q. Does the model get employee names / wages / bank?**  
No. Metrics are TypeScript (`lib/ai/metrics.ts`). LLM sees `toModelSnapshot` (`lib/ai/sanitize.ts`) — aggregates only. Permission `viewAiAnalytics` is admin + HR manager only (payroll roles blocked).

**Q. Flight-risk table — extra table?**  
No. Computed from `employee_profile` + `attendance` + `leave_request`. Cache of insight **cards** is `ai_insight`.

---

### 2.16 Employee portal

| Screen | Tables / FKs |
| --- | --- |
| `/employee` | Same attendance + leave as dashboard, scoped to `user.id` |
| `/employee/profile` | `employee_profile` via `userId` unique |
| `/employee/attendance` | `attendance.userId` |
| `/employee/leave` | `leave_request.userId`, `typeId`, `allocationId` |
| `/employee/payroll` | `payslip.employeeId` (validated/paid only) |

---

## 3. Trap questions (they will ask these)

**Q. Attendance FK to employee_profile?**  
No. **`user.id`.** Profile is joined when we need department.

**Q. Leave FK to employee_profile?**  
No. **`user.id`.** Allocation FK *is* to profile (`employeeId` on allocation).

**Q. Department name on payslip?**  
Payslip has no `departmentId`. Join `payslip.employee.department.name`.

**Q. Cascade delete of an organization?**  
Yes for profiles, departments, schedules, types, structures, payruns, AI insights. **Department delete does not cascade to employees** (Restrict).

**Q. Delete a user?**  
Cascade: session, account, profile, attendance, leave, legacy payroll. Profile cascade then takes contracts, allocations, payslips.

**Q. Delete a payrun?**  
Cascade payslips and (via payslip) lines. Structure stays (Restrict on `payrun.structureId`).

**Q. Why Restrict on `payrun.structureId`?**  
Keep salary config history. Deleting “Regular Salary” should not silently drop January payruns.

**Q. `verification` table FK?**  
**None.** Better Auth tokens keyed by `identifier` (usually email).

**Q. `net_salary` on legacy `payroll`?**  
Generated column in Postgres:  
`basic + (basic * hra_pct / 100) + (basic * allowance_pct / 100) - deductions`. Mapped `hra_pct` / `allowance_pct` / `net_salary`.

**Q. Decimal money?**  
`DECIMAL(12,2)` for money, `(8,2)` for leave days, `(6,2)` for hours. Never claim FLOAT.

**Q. Timezone?**  
Dates are `DATE` (no tz). App interprets calendar days as **Asia/Kolkata** (`lib/shared/dates.ts`). Schedule `timezone` defaults to that string.

**Q. Who owns People vs Payroll schema?**  
Malay: departments, schedules, contracts, attendance, leave, allocations, types (`20260905150000_oxp_domain`) — code now under `lib/actions/people/**` and `lib/people/**`. Krishil: wage/sentAt follow-up (`20260905170000_payroll_wage_sent`) and payrun engine — `lib/actions/payroll/**` and `lib/payroll/**`. AI: `20260905180000_ai_insights` — `lib/actions/ai.ts` and `lib/ai/**`. Auth/session: `lib/auth/**`.

---

## 4. Indexes you should be able to name

| Constraint | Why they ask |
| --- | --- |
| `user.email` unique | Login |
| `account (issuer, accountId)` unique | Credential account |
| `employee_profile.userId` unique | 1:1 profile |
| `employee_profile.employeeId` unique | Human-visible code |
| `department (organizationId, code)` unique | Dept codes per tenant |
| `time_off_type (organizationId, code)` unique | `paid` / `sick` per tenant |
| `attendance (userId, date)` unique | One punch / day |
| `payslip (payrunId, employeeId)` unique | One slip per person per run |
| `payroll (userId, month)` unique | Legacy month row |
| `contract.code` unique | Contract number |
| `leave_request (userId, status)` | Inbox of pending |
| `ai_insight (organizationId, generatedAt)` | Latest cards |

---

## 5. Enums (say the pipeline)

- **People:** `EmployeeStatus`, `EmployeeType`, `AttendanceStatus`, `LeaveStatus`, `ContractStatus`, `CalendarType`, `TimeOffUnit`, `TimeOffApprover`, `AllocationStatus`.
- **Payroll:** `SalaryCategory`, `RuleComputation`, `PayrunStatus`, `PayslipStatus`.
- **Role** enum is on **profile**; `user.role` is string.

Payrun/payslip pipeline to recite: **draft → computed → validated → paid**.

---

## 6. If they open a screen and point

Walk the sidebar top to bottom:

1. **Dashboard** — `lib/actions/dashboard.ts` + `lib/actions/payroll/payroll-dashboard.ts`. Reads profile, attendance, leave; payroll KPIs from payslip.  
2. **Employees** — `lib/actions/people/employees.ts`. Writes `departmentId`, `managerId`, `scheduleId`.  
3. **Contracts** — `lib/actions/people/contracts.ts`. Four FKs; running overlap in `lib/people/contract-period.ts`.  
4. **Schedules** — `lib/actions/people/schedules.ts`. Parent + cascaded lines (`lib/people/schedule-hours.ts`).  
5. **Departments** — `lib/actions/people/departments.ts`. Org FK; restrict from employees.  
6. **Attendance** — `lib/actions/people/attendance.ts`. `userId` + unique day.  
7. **Types / Allocations / Requests** — `time-off-types.ts` / `allocations.ts` / `leave.ts`. Type org FK; allocation to **profile**; request to **user** + type + optional allocation.  
8. **Structures / Rules** — `lib/actions/payroll/salary.ts`. Org → structure → cascaded rules.  
9. **Payruns / Payslips** — `lib/actions/payroll/payruns.ts`. Structure restrict; slips cascade from run; lines cascade from slip; `ruleId` not FK.  
10. **Users** — `lib/actions/users.ts`. User + account + profile.  
11. **AI Analytics** — `lib/actions/ai.ts`. `ai_insight.organizationId` plus `lib/ai/**` metrics.

If you freeze, start with: **“The FK lives on the child table.”** Then name child.column → parent.id. Then name the action under `lib/actions/people/` or `lib/actions/payroll/`.
