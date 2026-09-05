# Database invariants

Catalog of PeoplePay360 facts that PostgreSQL must eventually enforce. Status is as of Task 3 (CHECK constraints + BCNF unique keys). Later tasks copy `INVARIANT_SQL` from `lib/db/invariants.ts` **verbatim** into Prisma migrations.

**Status values**

| Status | Meaning |
| --- | --- |
| `missing` | Not enforced in Postgres and not a dedicated app rule |
| `app-only` | TypeScript / Zod / action checks; a crash or race can persist a violation |
| `enforced` | Already a UNIQUE / PK / FK / CHECK in Postgres (`prisma/schema.prisma` or a Task 2+ migration) |

Task 2 applied `INVARIANT_SQL.checks` in `prisma/migrations/20260906010000_check_constraints`. Task 3 applied `INVARIANT_SQL.uniques` plus the other BCNF uniques (including SQL-only `lower()` / `COALESCE` indexes) in `prisma/migrations/20260906020000_bcnf_unique_keys`. EXCLUDE and RLS are still not in Postgres. Existing UNIQUE indexes in the schema stay `enforced`.

Source of truth for SQL strings: [`lib/db/invariants.ts`](../../lib/db/invariants.ts) (`INVARIANT_SQL.checks` / `.uniques` / `.exclusion`). Task 3 copied **`.uniques`** verbatim.

---

## Date, duration, and checkout

### `leave_dates_ordered`

- **SQL:** `CHECK ("endDate" >= "startDate")` on `leave_request` (`leave_request_dates_ordered`)
- **Status:** `enforced`
- **Notes:** Applied by Task 2. `validateLeaveDates` in `lib/people/leave-rules.ts` still rejects inverted ranges in app code.

### `leave_duration_nonneg`

- **SQL:** `CHECK ("duration" >= 0)` on `leave_request` (`leave_request_duration_nonneg`)
- **Status:** `enforced`
- **Notes:** Applied by Task 2. Duration is also written by actions.

### `contract_dates_ordered`

- **SQL:** `CHECK ("endDate" IS NULL OR "endDate" >= "startDate")` on `contract` (`contract_dates_ordered`)
- **Status:** `enforced`
- **Notes:** `lib/people/contract-period.ts` compares windows in app code. Open-ended contracts (`endDate` NULL) are valid.

### `attendance_checkout_needs_checkin`

- **SQL:** `CHECK ("checkOut" IS NULL OR "checkIn" IS NOT NULL)` on `attendance` (`attendance_checkout_needs_checkin`)
- **Status:** `enforced`
- **Notes:** Applied by Task 2. Clock-out and admin edits in `lib/actions/people/attendance.ts` also require check-in first.

---

## Money and progress

### `wage_only_on_contract`

- **SQL:** none yet (Task 7 drops `employee_profile.wage`)
- **Status:** `app-only`
- **Notes:** Wage is dual-written on `employee_profile.wage` and `contract.wage`. Payroll still falls back to `profile.wage`. Target: running `contract.wage` only.

### `contract_wage_nonneg`

- **SQL:** `CHECK ("wage" >= 0)` on `contract` (`contract_wage_nonneg`)
- **Status:** `enforced`
- **Notes:** Applied by Task 2. Zod still requires a positive wage on some forms.

### `payslip_amounts_nonneg`

- **SQL:** `CHECK ("wage" >= 0 AND "gross" >= 0)` on `payslip` (`payslip_amounts_nonneg`)
- **Status:** `enforced`

### `performance_goal_progress`

- **SQL:** `CHECK ("progress" >= 0 AND "progress" <= 100)` on `performance_goal` (`performance_goal_progress`)
- **Status:** `enforced`
- **Notes:** Applied by Task 2. Performance actions still clamp / interpret progress in TypeScript.

---

## Schedules

### `schedule_line_one_per_weekday`

- **SQL:** `CREATE UNIQUE INDEX "working_schedule_line_scheduleId_weekday_key" ON "working_schedule_line" ("scheduleId", "weekday");` (`INVARIANT_SQL.uniques.scheduleLineOnePerWeekday`)
- **Status:** `enforced`
- **Notes:** Applied by Task 3. `hasUniqueWeekdays` in `lib/people/schedule-hours.ts` still documents the domain rule.

### `schedule_line_weekday`

- **SQL:** `CHECK ("weekday" >= 1 AND "weekday" <= 7)` on `working_schedule_line` (`working_schedule_line_weekday`)
- **Status:** `enforced`

### `schedule_line_range`

- **SQL:** `CHECK ("endMin" > "startMin" AND "startMin" >= 0 AND "endMin" <= 24 * 60)` on `working_schedule_line` (`working_schedule_line_range`)
- **Status:** `enforced`
- **Notes:** Applied by Task 2. `lineHours` still assumes `endMin > startMin` in app code.

### `schedule_hours_positive`

- **SQL:** `CHECK ("hoursPerWeek" > 0 AND "daysPerWeek" BETWEEN 1 AND 7)` on `working_schedule` (`working_schedule_hours_positive`)
- **Status:** `enforced`

---

## Leave allocations and overlap

### `allocation_unique_per_year`

- **SQL:** `CREATE UNIQUE INDEX "time_off_allocation_employee_type_year_key" ON "time_off_allocation" ("employeeId", "typeId", "validityYear");` (`INVARIANT_SQL.uniques.allocationUniquePerYear`)
- **Status:** `enforced`
- **Notes:** Applied by Task 3.

### `allocation_amounts`

- **SQL:** `CHECK ("allocated" >= 0 AND "taken" >= 0 AND "taken" <= "allocated" + 0.01)` on `time_off_allocation` (`time_off_allocation_amounts`)
- **Status:** `enforced`
- **Notes:** Applied by Task 2. `remaining()` in `lib/people/time-off-balance.ts` is still TypeScript. The `+ 0.01` slack covers decimal rounding.

### `leave_balance_only_on_allocation`

- **SQL:** none yet (Task 6 drops `employee_profile.paidLeaveBalance`)
- **Status:** `app-only`
- **Notes:** Remaining paid leave is dual-written to `employee_profile.paidLeaveBalance` and `time_off_allocation.taken`. `decideLeaveAction` can decrement either path. Target: `allocated - taken` on the approved allocation only.

### `no_overlapping_approved_leave`

- **SQL:** `btree_gist` exclusion on `leave_request` (`leave_request_no_approved_overlap`) — `EXCLUDE USING gist` on `employeeId` + `daterange(startDate, endDate, '[]')` where `status = 'approved'`
- **Status:** `app-only`
- **Notes:** `findOverlappingLeave` in `lib/people/leave-rules.ts` is advisory. Two approvers can still persist overlapping approved rows. Task 5 copies `INVARIANT_SQL.exclusion.noOverlappingApprovedLeave` after Task 4 adds `employeeId` on `leave_request`.

---

## Already enforced (do not undo)

These are UNIQUE indexes already in `prisma/schema.prisma`. They are **not** missing.

| Name | SQL / Prisma | Status |
| --- | --- | --- |
| `attendance_one_row_per_user_day` | `@@unique([userId, date])` on `attendance` | `enforced` |
| `payslip_one_per_employee_per_run` | `@@unique([payrunId, employeeId])` on `payslip` | `enforced` |
| `review_one_per_employee_per_cycle` | `@@unique([cycleId, employeeId])` on `performance_review` | `enforced` |
| `department_code_per_org` | `@@unique([organizationId, code])` on `department` | `enforced` |
| `time_off_type_code_per_org` | `@@unique([organizationId, code])` on `time_off_type` | `enforced` |
| `job_opening_code_per_org` | `@@unique([organizationId, code])` on `job_opening` | `enforced` |
| `attendance_rollup_one_per_org_day` | `@@unique([organizationId, date])` on `attendance_daily_rollup` | `enforced` |
| `profile_one_per_user` | `employee_profile.userId` `@unique` | `enforced` |
| `employee_id_per_org` | `@@unique([organizationId, employeeId])` on `employee_profile` (`employee_profile_organizationId_employeeId_key`) | `enforced` (Task 3 dropped the global `employee_profile_employeeId_key`; trigram GIN kept) |
| `department_name_per_org` | SQL-only unique `(organizationId, lower(name))` on `department` (`department_organizationId_lower_name_key`) | `enforced` |
| `salary_rule_code_per_structure` | `@@unique([structureId, code])` on `salary_rule` | `enforced` |
| `payrun_one_per_org_period_type` | SQL-only unique `(organizationId, periodStart, periodEnd, COALESCE(bcnf_employee_type_text(employeeType), ''))` on `payrun` (`payrun_org_period_type_key`) | `enforced` |
| `salary_structure_name_per_org` | SQL-only unique `(organizationId, lower(name))` on `salary_structure` (`salary_structure_organizationId_name_key`) | `enforced` |

---

## Task 2 CHECK SQL (copied from `INVARIANT_SQL.checks`)

Applied by `prisma/migrations/20260906010000_check_constraints`. Status `enforced`.

```sql
ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_dates_ordered"
  CHECK ("endDate" >= "startDate");

ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_duration_nonneg"
  CHECK ("duration" >= 0);

ALTER TABLE "contract"
  ADD CONSTRAINT "contract_dates_ordered"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "contract"
  ADD CONSTRAINT "contract_wage_nonneg"
  CHECK ("wage" >= 0);

ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_checkout_needs_checkin"
  CHECK ("checkOut" IS NULL OR "checkIn" IS NOT NULL);

ALTER TABLE "working_schedule_line"
  ADD CONSTRAINT "working_schedule_line_weekday"
  CHECK ("weekday" >= 1 AND "weekday" <= 7);

ALTER TABLE "working_schedule_line"
  ADD CONSTRAINT "working_schedule_line_range"
  CHECK ("endMin" > "startMin" AND "startMin" >= 0 AND "endMin" <= 24 * 60);

ALTER TABLE "working_schedule"
  ADD CONSTRAINT "working_schedule_hours_positive"
  CHECK ("hoursPerWeek" > 0 AND "daysPerWeek" BETWEEN 1 AND 7);

ALTER TABLE "time_off_allocation"
  ADD CONSTRAINT "time_off_allocation_amounts"
  CHECK ("allocated" >= 0 AND "taken" >= 0 AND "taken" <= "allocated" + 0.01);

ALTER TABLE "payslip"
  ADD CONSTRAINT "payslip_amounts_nonneg"
  CHECK ("wage" >= 0 AND "gross" >= 0);

ALTER TABLE "performance_goal"
  ADD CONSTRAINT "performance_goal_progress"
  CHECK ("progress" >= 0 AND "progress" <= 100);
```

## Task 5 exclusion SQL (copy from `INVARIANT_SQL.exclusion`)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_no_approved_overlap"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  )
  WHERE (status = 'approved');
```
