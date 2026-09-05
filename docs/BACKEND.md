# PeoplePay360 — Backend Overview

This app has **no separate Express/FastAPI server**. The backend runs inside **Next.js App Router** using:


| Layer             | Tech                                                     |
| ----------------- | -------------------------------------------------------- |
| Mutations & reads | **Server Actions** (`lib/actions/`**)                    |
| Auth              | **Better Auth** (email/password, httpOnly cookies)       |
| ORM               | **Prisma 7** + `@prisma/adapter-pg`                      |
| Database          | **PostgreSQL**                                           |
| Domain logic      | Pure helpers under `lib/people`, `lib/payroll`, `lib/ai` |


UI lives in `app/**` and `components/**`. Those folders call into `lib/` — they are not the backend.

---

## Architecture

```
Browser (app / components)
        │
        ▼
┌───────────────────────────────────────┐
│  proxy.ts          route / role gate  │
│  app layouts       requireStaffPage…  │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  lib/actions/**    Server Actions API │
│    ├── auth / users / dashboard / ai  │
│    ├── people/*                       │
│    └── payroll/*                      │
└───────────────────────────────────────┘
        │
        ├── lib/auth/**      session + permissions
        ├── lib/people/**    leave / attendance / contracts rules
        ├── lib/payroll/**   salary compute engine
        ├── lib/ai/**        metrics, insights, copilot
        ├── lib/shared/**    types, Zod, mappers, mail, dates
        └── lib/db.ts        Prisma client
                │
                ▼
        generated/prisma  →  PostgreSQL
```

### Supporting entry points


| Piece               | Path                             | Role                                            |
| ------------------- | -------------------------------- | ----------------------------------------------- |
| Auth HTTP catch-all | `app/api/auth/[...all]/route.ts` | Better Auth REST handlers                       |
| Request gate        | `proxy.ts`                       | Session, password-change, role → path redirects |
| Schema              | `prisma/schema.prisma`           | Source of truth for tables                      |
| Migrations          | `prisma/migrations/`             | Applied history                                 |
| Seed                | `prisma/seed.ts`                 | Demo org, users, sample data                    |
| Generated client    | `generated/prisma/`              | **Do not edit** — run `prisma generate`         |


---

## `lib/` folder map (current)

After the domain reorg, backend code is grouped by concern:

```
lib/
├── db.ts                         # Prisma singleton (pg adapter)
│
├── auth/                         # Identity & access
│   ├── server.ts                 # betterAuth config (was lib/auth.ts)
│   ├── client.ts                 # React auth client (was auth-client.ts)
│   ├── session.ts                # getCurrentUser, requirePermission, …
│   ├── permissions.ts            # Role → permission → admin path matrix
│   └── permissions.test.ts
│
├── shared/                       # Cross-cutting utilities
│   ├── types.ts                  # Shared TS types / ActionResult
│   ├── validations.ts            # Zod schemas
│   ├── mappers.ts                # DB row → UI DTO
│   ├── dates.ts                  # Kolkata timezone helpers
│   ├── mail.ts                   # Nodemailer (credentials, payslips)
│   ├── logger.ts
│   ├── utils.ts                  # cn() for class names
│   └── notion-avatar.ts          # DiceBear Notionists SVG seeds
│
├── people/                       # People / HR pure rules (mostly no DB)
│   ├── leave-rules.ts
│   ├── time-off-balance.ts
│   ├── attendance-metrics.ts
│   ├── contract-period.ts
│   ├── schedule-hours.ts
│   ├── employee-id.ts            # ORG-YYYY-NNN generator
│   └── department-code.ts
│
├── payroll/                      # Payroll pure engine
│   ├── compute.ts                # Ordered salary rule evaluation
│   ├── warnings.ts               # Missing bank / contract / duplicate
│   ├── regular-salary.ts         # Seed rule table
│   ├── period-wage.ts
│   └── worked-days.ts
│
├── ai/                           # Analytics helpers
│   ├── metrics.ts                # Attendance health, flight risk, …
│   ├── build-snapshot.ts         # Permission-aware org snapshot
│   ├── sanitize.ts / snapshot.ts
│   ├── insights.ts / copilot.ts
│   └── client.ts                 # Optional OpenAI
│
└── actions/                      # "use server" — the product API
    ├── auth.ts
    ├── dashboard.ts
    ├── profile.ts
    ├── users.ts
    ├── ai.ts
    ├── people/
    │   ├── employees.ts
    │   ├── departments.ts
    │   ├── schedules.ts
    │   ├── contracts.ts
    │   ├── attendance.ts
    │   ├── leave.ts
    │   ├── allocations.ts
    │   └── time-off-types.ts
    └── payroll/
        ├── salary.ts
        ├── payruns.ts
        ├── payroll-dashboard.ts
        └── payroll.ts            # Legacy month-row payroll UI
```

### Import conventions

Use the `@/` alias (see `tsconfig.json`):


| Old path (pre-reorg)      | New path                         |
| ------------------------- | -------------------------------- |
| `@/lib/auth`              | `@/lib/auth/server`              |
| `@/lib/auth-client`       | `@/lib/auth/client`              |
| `@/lib/session`           | `@/lib/auth/session`             |
| `@/lib/permissions`       | `@/lib/auth/permissions`         |
| `@/lib/types`             | `@/lib/shared/types`             |
| `@/lib/validations`       | `@/lib/shared/validations`       |
| `@/lib/leave-rules`       | `@/lib/people/leave-rules`       |
| `@/lib/actions/employees` | `@/lib/actions/people/employees` |
| `@/lib/actions/payruns`   | `@/lib/actions/payroll/payruns`  |


Unchanged: `@/lib/db`, `@/lib/payroll/*`, `@/lib/ai/*`.

---

## Data layer

- **Connection:** `lib/db.ts` reads `DATABASE_URL`, builds `PrismaClient` with the Postgres adapter, caches it on `globalThis` in dev.
- **Client output:** `generated/prisma/` (configured in `schema.prisma`).
- **Alias:** Prefer `@/generated/prisma/client` over deep relative paths from nested action files.

### Models by domain


| Area             | Models                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Auth             | `User`, `Session`, `Account`, `Verification`                                                          |
| Org / People     | `Organization`, `Department`, `EmployeeProfile`, `WorkingSchedule`, `WorkingScheduleLine`, `Contract` |
| Time             | `Attendance`, `LeaveRequest`, `TimeOffType`, `TimeOffAllocation`                                      |
| Payroll (new)    | `SalaryStructure`, `SalaryRule`, `Payrun`, `Payslip`, `PayslipLine`                                   |
| Payroll (legacy) | `Payroll` — older per-employee month row; payruns are the preferred flow                              |
| AI               | `AiInsight`                                                                                           |


### Key `User` fields


| Field                | Meaning                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `role`               | `admin` | `hr_manager` | `hr_payroll_user` | `hr_payroll_manager` | `employee` |
| `mustChangePassword` | Force `/change-password` after first login / admin create                      |
| `profile`            | Optional `EmployeeProfile` (HR data linked by `userId`)                        |


### Commands

```bash
npx prisma migrate deploy   # apply migrations
npx prisma generate         # regenerate client (also on postinstall / build)
npm run db:seed             # demo data
npm run db:studio           # browse tables
```

---

## Auth & authorization

### How login works

1. UI → `signInAction` (`lib/actions/auth.ts`).
2. Action calls `auth.api.signInEmail` (`lib/auth/server.ts`).
3. Better Auth verifies the hash on `Account.password`, writes `Session`, sets **httpOnly** cookie (`nextCookies()`).
4. Redirect:
  - `mustChangePassword` → `/change-password`
  - staff role → `/admin`
  - employee → `/employee`

Public sign-up is **disabled** (`disableSignUp: true`). New accounts come from admin **Add User** or seed.

### Layers of protection


| Layer         | File                                              | What it does                                                                                      |
| ------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Edge-ish gate | `proxy.ts`                                        | Unauthenticated → login; employees blocked from `/admin`; staff path ACL via `canAccessAdminPath` |
| Layouts       | `app/admin/layout.tsx`, `app/employee/layout.tsx` | `requireStaffPage` / `requirePageUser`                                                            |
| Actions       | `lib/auth/session.ts`                             | `requireUser`, `requirePermission`, `requireRole`                                                 |
| Permissions   | `lib/auth/permissions.ts`                         | Role → permission list + admin URL map                                                            |


### Roles & permissions (summary)


| Permission                               | Typical holders                  |
| ---------------------------------------- | -------------------------------- |
| `viewAdminDashboard`                     | admin, HR manager, payroll roles |
| `managePeople`                           | admin, HR manager, payroll roles |
| `approveLeave` / `manageTimeOffTypes`    | admin, HR manager, payroll roles |
| `viewPayrollAll` / `editPayroll`         | admin, payroll user/manager      |
| `finalizePayroll` / `manageSalaryConfig` | admin, payroll **manager**       |
| `createUsers`                            | **admin only**                   |
| `viewAiAnalytics`                        | admin, HR manager                |


`employee` has an empty permission list for admin actions; they use employee self-service actions gated by `requireUser` + ownership checks.

### Creating an employee (credentials)

1. Admin opens **People → Employees → Add User**.
2. `createEmployeeAction` (`lib/actions/people/employees.ts`) requires `createUsers`.
3. System creates:
  - `User` + credential `Account` (hashed **temporary password**)
  - `EmployeeProfile` with generated `employeeId` (`lib/people/employee-id.ts`)
  - `mustChangePassword = true`
4. Emails credentials via `lib/shared/mail.ts` (`SMTP_*`). If mail fails, UI toast shows the temp password.
5. New user must change password on first login.

---

## Server Actions (product API)

Every action module is `"use server"` and returns:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

### Catalog


| Path                                   | Responsibility                                           |
| -------------------------------------- | -------------------------------------------------------- |
| `actions/auth.ts`                      | Sign-in, sign-out, change password                       |
| `actions/dashboard.ts`                 | Admin + employee dashboard stats                         |
| `actions/profile.ts`                   | Employee self-profile update                             |
| `actions/users.ts`                     | Admin user list / role updates                           |
| `actions/ai.ts`                        | Analytics snapshot, generate insights, HR copilot        |
| `actions/people/employees.ts`          | CRUD hub, create with temp password                      |
| `actions/people/departments.ts`        | Department CRUD                                          |
| `actions/people/schedules.ts`          | Working schedules                                        |
| `actions/people/contracts.ts`          | Contracts + period checks                                |
| `actions/people/attendance.ts`         | Logs, clock in/out, admin upsert                         |
| `actions/people/leave.ts`              | Apply / approve / reject leave                           |
| `actions/people/allocations.ts`        | Time-off allocations                                     |
| `actions/people/time-off-types.ts`     | Leave type config                                        |
| `actions/payroll/salary.ts`            | Structures & rules CRUD                                  |
| `actions/payroll/payruns.ts`           | Create → compute → validate → mark paid; payslips; email |
| `actions/payroll/payroll-dashboard.ts` | Payroll KPI rollups for admin dashboard                  |
| `actions/payroll/payroll.ts`           | Legacy month payroll rows                                |


### Standard action pattern

1. `requireUser` / `requirePermission(...)`.
2. Zod parse (`lib/shared/validations.ts`).
3. Domain rules (`lib/people/*` or `lib/payroll/*`).
4. Prisma read/write.
5. Optional `revalidatePath(...)`.
6. Return `{ ok: true, data }` or `{ ok: false, error }` (never throw raw errors to the client).

### Example: approve leave

```
UI (leave-client)
  → decideLeaveAction (actions/people/leave.ts)
      → requirePermission("approveLeave")
      → leave-rules / time-off-balance
      → prisma.leaveRequest.update (+ allocation taken days)
      → { ok: true }
```

### Example: payrun lifecycle

```
listEligibleEmployees → createPayrunAction
  → computePayrunAction     (lib/payroll/compute.ts + warnings)
  → validatePayrunAction    (blocks if missing contract, etc.)
  → markPayrunPaidAction    (finalizePayroll)
  → sendPayslipsAction      (mail)
```

---

## Domain helpers (why they exist)

Keep **pure, testable** logic out of Server Actions when possible:


| Module                         | Purpose                                           |
| ------------------------------ | ------------------------------------------------- |
| `people/leave-rules.ts`        | Overlaps, past-date rules, paid-day counting      |
| `people/time-off-balance.ts`   | Allocation remaining / over-balance               |
| `people/attendance-metrics.ts` | Late, overtime, missing checkout                  |
| `people/contract-period.ts`    | Overlapping contracts, wage period coverage       |
| `people/schedule-hours.ts`     | Weekly expected hours from schedule lines         |
| `payroll/compute.ts`           | Safe formula sandbox for salary rules (no `eval`) |
| `payroll/warnings.ts`          | Missing bank / contract / duplicate payslip       |
| `ai/metrics.ts`                | Org health scores used by analytics               |


Run them with:

```bash
npm test
```

(54 unit tests across permissions, people, payroll, AI — not an HTTP e2e suite.)

---

## Environment

Copy `.env.example` → `.env`:


| Variable                        | Required | Purpose                                                                  |
| ------------------------------- | -------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`                  | Yes      | Postgres connection string                                               |
| `BETTER_AUTH_SECRET`            | Yes      | Session signing (≥ 32 chars)                                             |
| `BETTER_AUTH_URL`               | Yes      | Canonical app URL for auth                                               |
| `NEXT_PUBLIC_APP_URL`           | Yes      | Public URL (login links, auth client)                                    |
| `SMTP_HOST/PORT/USER/PASS/FROM` | For mail | New-user credentials + payslip emails                                    |
| `OPENAI_API_KEY`                | Optional | AI insight narratives / copilot phrasing (metrics still work without it) |


---

## Seeded demo logins

After `npm run db:seed`:


| Role           | Email                          | Password          |
| -------------- | ------------------------------ | ----------------- |
| Admin          | `admin@oddo.com`               | `admin@oddo@1234` |
| Demo employees | e.g. `william.joseph@oddo.com` | `Employee@1234`   |


---

## Where to put new backend code


| You are adding…                     | Put it in…                         |
| ----------------------------------- | ---------------------------------- |
| A new UI mutation / query           | `lib/actions/<domain>/…`           |
| Auth / session helper               | `lib/auth/`                        |
| Pure leave/attendance/contract math | `lib/people/` + a `*.test.ts`      |
| Salary formula / payrun warning     | `lib/payroll/`                     |
| Analytics metric                    | `lib/ai/`                          |
| Shared DTO / Zod schema             | `lib/shared/`                      |
| New table                           | `prisma/schema.prisma` + migration |


Do **not** put business rules only inside React components, and do **not** hand-edit `generated/prisma/`.

---

## One-line summary

**Backend = Postgres + Prisma + Better Auth + domain-organized Server Actions**, with pure engines in `lib/people`, `lib/payroll`, and `lib/ai`, and shared plumbing in `lib/shared` / `lib/auth`.