# PeoplePay360 — Backend Overview

This project does **not** use a separate Express/FastAPI server. The backend lives inside the **Next.js App Router** app: **Server Actions**, **Better Auth**, **Prisma**, and **PostgreSQL**.

---

## Architecture (mental model)

```
Browser / UI (app/**, components/**)
        │
        ▼
Server Actions (lib/actions/**)     ← main “API” for the product
        │
        ├── auth (lib/auth/**)
        ├── people helpers (lib/people/**)
        ├── payroll engine (lib/payroll/**)
        ├── AI helpers (lib/ai/**)
        ├── shared (lib/shared/**)
        └── Prisma client (lib/db.ts → generated/prisma)
                │
                ▼
        PostgreSQL (DATABASE_URL)
```

Also:

| Piece | Path | Role |
| --- | --- | --- |
| Auth HTTP API | `app/api/auth/[...all]/route.ts` | Better Auth endpoints |
| Request gate | `proxy.ts` | Session / role redirects before pages load |
| Schema & migrations | `prisma/` | DB models + history |
| Generated client | `generated/prisma/` | Auto-generated — do not edit |

---

## Where is the backend?

| Concern | Location |
| --- | --- |
| DB connection | `lib/db.ts` |
| Auth config | `lib/auth/server.ts`, `lib/auth/client.ts` |
| Session / RBAC helpers | `lib/auth/session.ts`, `lib/auth/permissions.ts` |
| Login / logout / password | `lib/actions/auth.ts` |
| Shared types / Zod / mappers | `lib/shared/**` |
| People domain helpers | `lib/people/**` |
| Payroll engine (pure) | `lib/payroll/**` |
| AI analytics helpers | `lib/ai/**` |
| **Server actions** | `lib/actions/**` |
| Schema | `prisma/schema.prisma` |
| Seed data | `prisma/seed.ts` |

UI pages under `app/admin/**` and `app/employee/**` mostly **call** these actions; they are not the backend themselves.

---

## `lib/` layout

```
lib/
  auth/           # Better Auth, session, permissions
  shared/         # types, validations, mappers, dates, mail, logger, utils
  people/         # leave/attendance/contract/schedule helpers
  payroll/        # salary compute engine + warnings
  ai/             # snapshot, metrics, insights, copilot
  actions/
    auth.ts
    dashboard.ts
    profile.ts
    users.ts
    ai.ts
    people/       # employees, departments, schedules, contracts, attendance, leave, …
    payroll/      # salary, payruns, payroll, payroll-dashboard
  db.ts
```

---

## Data layer (Prisma + Postgres)

- **ORM:** Prisma 7 with `@prisma/adapter-pg`
- **DB:** PostgreSQL (`DATABASE_URL` in `.env`)
- **Client output:** `generated/prisma/` (via `prisma generate`)

### Core models

| Area | Models |
| --- | --- |
| Auth | `User`, `Session`, `Account`, `Verification` |
| Org / People | `Organization`, `Department`, `EmployeeProfile`, `WorkingSchedule`, `WorkingScheduleLine`, `Contract` |
| Time | `Attendance`, `LeaveRequest`, `TimeOffType`, `TimeOffAllocation` |
| Payroll | `SalaryStructure`, `SalaryRule`, `Payrun`, `Payslip`, `PayslipLine` |
| Legacy payroll row | `Payroll` (older per-employee month model; newer flow uses Payrun/Payslip) |
| AI | `AiInsight` |

### Useful commands

```bash
npx prisma migrate deploy   # apply migrations
npm run db:seed             # seed demo users / org data
npm run db:studio           # browse tables
```

---

## Auth backend

1. **Better Auth** (`lib/auth/server.ts`) — email/password, Prisma adapter, public sign-up **disabled**.
2. Cookies set via `nextCookies()`; sessions stored in `Session`.
3. Extra user fields: `role`, `mustChangePassword`.
4. **Login / change password / logout** → `lib/actions/auth.ts` (calls `auth.api.*`).
5. **Route protection** → `proxy.ts` + layout helpers in `lib/auth/session.ts`.
6. **Fine-grained access** → `lib/auth/permissions.ts` (e.g. `managePeople`, `finalizePayroll`, `viewAiAnalytics`).

Accounts are created by admins (`createEmployeeAction` / user management), not by public registration.

---

## Server Actions (the product API)

Each file is `"use server"` and returns an `ActionResult<T>` (`{ ok: true, data }` or `{ ok: false, error }`).

| Path | Backend responsibility |
| --- | --- |
| `actions/auth.ts` | Sign-in, sign-out, change password |
| `actions/people/employees.ts` | List/create/update employees, hub data, temp passwords |
| `actions/people/departments.ts` | Department CRUD |
| `actions/people/schedules.ts` | Working schedules |
| `actions/people/contracts.ts` | Employment contracts |
| `actions/people/attendance.ts` | Logs, clock in/out, admin upsert |
| `actions/people/leave.ts` | Apply / approve / reject leave |
| `actions/people/allocations.ts` | Time-off allocations |
| `actions/people/time-off-types.ts` | Leave type config |
| `actions/profile.ts` | Employee self-update |
| `actions/dashboard.ts` | Admin + employee dashboard stats |
| `actions/payroll/salary.ts` | Salary structures & rules |
| `actions/payroll/payruns.ts` | Create → compute → validate → mark paid; payslips; email |
| `actions/payroll/payroll-dashboard.ts` | Payroll rollup metrics |
| `actions/payroll/payroll.ts` | Legacy payroll list/upsert |
| `actions/users.ts` | Admin user management |
| `actions/ai.ts` | Analytics snapshot, insights, HR copilot |

Domain math that should stay testable (no DB) sits next to actions:

- `lib/people/leave-rules.ts`, `time-off-balance.ts`, `attendance-metrics.ts`, …
- `lib/payroll/compute.ts`, `warnings.ts`, …
- `lib/ai/metrics.ts`, `copilot.ts`, …

---

## Request flow (example: approve leave)

1. Admin UI calls `decideLeaveAction(...)`.
2. Action runs `requirePermission("approveLeave")`.
3. Validates input (`lib/shared/validations.ts` / Zod).
4. Applies rules (`lib/people/leave-rules.ts`, balance helpers).
5. Updates `LeaveRequest` (and related allocation) via Prisma.
6. Returns `{ ok: true }` or an error string for the UI toast.

Same pattern for payroll, attendance, employees, etc.

---

## Environment (backend-related)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `BETTER_AUTH_SECRET` | Session signing |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | App origin for auth |
| `SMTP_*` | Email (new users, payslips) |
| `OPENAI_API_KEY` | Optional — AI narratives / copilot phrasing |

See `.env.example` for the full template.

---

## Tests covering backend logic

```bash
npm test
```

Covers permissions, leave rules, attendance metrics, contract periods, payroll compute/warnings, and AI helpers — pure logic + permission matrix, not a live HTTP suite.

---

## One-line summary

**Backend = PostgreSQL + Prisma + Better Auth + `lib/actions` Server Actions**, with domain folders under `lib/auth`, `lib/people`, `lib/payroll`, `lib/ai`, and `lib/shared`.
