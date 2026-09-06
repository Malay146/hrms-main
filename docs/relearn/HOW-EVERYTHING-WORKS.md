# How HRMS Works — Relearn Guide

A plain-language map of this codebase: folders, request flow, auth, database, and each product domain.

Use this when you forget *where* something lives or *how* a click becomes a database write.

---

## 1. What this app is

**HRMS (PeoplePay360)** is a single-organization HR + payroll web app.


| Piece     | Choice                                                            |
| --------- | ----------------------------------------------------------------- |
| Framework | **Next.js App Router** (React Server Components + Server Actions) |
| Auth      | **Better Auth** (email/password, httpOnly cookies)                |
| Database  | **PostgreSQL**                                                    |
| ORM       | **Prisma 7** (`@prisma/adapter-pg`)                               |
| UI        | Zinc brand system in `DESIGN.md` + Tailwind                       |
| AI        | Optional OpenAI for insights/copilot; metrics work without a key  |


There is **no separate Express/FastAPI backend**.  
Pages and components call **Server Actions** in `lib/actions/`**. Those talk to Prisma.

---



## 2. Big mental model (one request)

```
Browser
  → proxy.ts                 (session + role gate)
  → app/.../page.tsx         (RSC loads data OR client UI)
  → lib/actions/...          ("use server" mutations / lists)
  → lib/auth | people | payroll | ai | jobs
  → lib/db.ts → generated/prisma → PostgreSQL
```

**Rule of thumb**

- `app/` + `components/` = screens and chrome  
- `lib/actions/` = the API surface the UI calls  
- `lib/{people,payroll,ai,...}/` = pure business rules (no React)  
- `prisma/` = schema + migrations + seed  
- `generated/` = auto-built Prisma client (**never edit by hand**)

---



## 3. Root folder map

```
HRMS-main/
├── app/                 # Routes (URLs). Next.js App Router.
├── components/          # Reusable UI (layout, forms, charts, icons).
├── lib/                 # Backend logic + shared helpers.
├── prisma/              # Schema, migrations, seed scripts.
├── generated/           # Prisma client output (gitignored).
├── public/              # Static assets  (images, etc.).
├── docs/                # Plans, QA notes, this relearn guide.
├── utils/               # Tiny helpers (e.g. cn()).
├── proxy.ts             # Request gate (auth redirects) — Next 16 style.
├── DESIGN.md            # Visual system — read before UI changes.
├── package.json         # Scripts + dependencies.
└── .env                 # Secrets (DATABASE_URL, AUTH, SMTP, OPENAI…).
```

Ignore for day-to-day learning: `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`.

---



## 4. `app/` — URLs and pages

Next.js: **folder path ≈ URL**.


| Path                     | Who uses it | Purpose                   |
| ------------------------ | ----------- | ------------------------- |
| `app/page.tsx`           | Public      | Landing                   |
| `app/login/`             | Public      | Sign in                   |
| `app/logout/`            | Anyone      | Sign out                  |
| `app/change-password/`   | Logged-in   | Forced password change    |
| `app/admin/**`           | Staff roles | Admin console             |
| `app/employee/**`        | Employees   | Self-service              |
| `app/api/auth/[...all]/` | System      | Better Auth HTTP handlers |
| `app/api/v1/`            | API clients | REST-ish OpenAPI surface  |
| `app/api/cron/jobs/`     | Cron        | Background job runner     |
| `app/swagger-ui/`        | Devs        | API docs UI               |




### Typical page pattern

1. **Server page** (`page.tsx`) loads data via a server action / query.
2. Passes props into a **client component** (`*-client.tsx`) for interactivity.
3. Client calls more server actions on button clicks (clock in, approve leave, etc.).

Example:

- `app/employee/attendance/page.tsx` → loads logs  
- `app/employee/attendance/attendance-client.tsx` → timer, filters, clock buttons



### Admin vs employee shells

- `app/admin/layout.tsx` — sidebar for staff  
- `app/employee/layout.tsx` — employee nav

Layouts often call session helpers so the wrong role never sees the shell.

### Admin areas (under `app/admin/`)


| Folder            | Feature                                                         |
| ----------------- | --------------------------------------------------------------- |
| `people/`         | Employees, departments, attendance, leave, contracts, schedules |
| `hr/payroll/`     | Payruns, payslips, salary rules                                 |
| `hr/performance/` | Cycles & reviews                                                |
| `hr/recruitment/` | Jobs & candidates                                               |
| `analytics/`      | AI workforce analytics                                          |
| `notifications/`  | In-app notifications                                            |
| `settings/`       | Org / admin settings chrome                                     |


---



## 5. `components/` — UI building blocks

```
components/
├── layout/          # Sidebar, navbar, command palette, attendance widget
├── ui/              # Buttons, modal, badge, date picker, pagination…
├── auth/            # Login / password fields
├── icons/           # Custom brand icons (prefer these in sidebar)
├── charts/          # Recharts tooltip helpers
├── ai/              # Copilot widget
├── attendance/      # Shift elapsed timer, etc.
├── leave/           # Attendance calendar for leave UI
├── notifications/   # Notification UI pieces
├── landing/         # Marketing/landing sections
├── section/         # Larger composed sections (dashboard)
├── providers/       # React Query, theme wrappers
└── system/          # Toasts / system chrome
```

**Don’t invent a new look.** Match `DESIGN.md` (zinc primary, page shell `rounded-2xl`, etc.).

---



## 6. `lib/` — where the real logic lives

```
lib/
├── db.ts                 # Prisma singleton (pool size, generation bump)
├── auth/                 # Better Auth + roles/permissions/session
├── actions/              # Server Actions (what UI calls)
│   ├── auth.ts
│   ├── dashboard.ts
│   ├── ai.ts
│   ├── performance.ts
│   ├── recruitment.ts
│   ├── notifications.ts
│   ├── people/           # employees, leave, attendance, contracts…
│   └── payroll/          # payruns, payroll dashboard…
├── people/               # Pure rules: leave overlap, attendance metrics…
├── payroll/              # Salary formula engine, worked days
├── performance/          # Review types / helpers
├── recruitment/          # Recruitment helpers
├── ai/                   # Snapshots, metrics, copilot, insights
├── jobs/                 # Background queue + handlers (payrun, AI, rollups)
├── api/v1/               # OpenAPI operations wrapping actions
└── shared/               # types, zod schemas, dates, mappers, mail, logger
```



### Layers (important)


| Layer                | May import            | Must not                           |
| -------------------- | --------------------- | ---------------------------------- |
| `components` / `app` | actions, shared types | Prisma directly (prefer actions)   |
| `lib/actions`        | db, auth, domain libs | React UI                           |
| `lib/people` etc.    | shared utils only     | Next/React, Prisma (when possible) |
| `lib/db`             | Prisma client         | Business rules                     |




### `lib/shared/` cheat sheet


| File             | Job                                                |
| ---------------- | -------------------------------------------------- |
| `types.ts`       | Shared TS types (`ActionResult`, list item shapes) |
| `validations.ts` | Zod schemas for forms/actions                      |
| `dates.ts`       | Asia/Kolkata date keys, inclusive day counts       |
| `mappers.ts`     | DB row → UI list item                              |
| `mail.ts`        | SMTP / Gmail app password mail                     |
| `logger.ts`      | Structured logs + `withTiming`                     |
| `errors.ts`      | Action error message helpers                       |


Almost every action returns:

```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
```

UI checks `result.ok` and toasts `result.error`.

---



## 7. Auth & roles



### Roles (5)

Defined in Prisma `enum Role` and `lib/auth/permissions.ts`:

1. `admin` — full access
2. `hr_manager` — people, leave, AI analytics, performance
3. `hr_payroll_manager` — people + full payroll (including finalize)
4. `hr_payroll_user` — people + payroll edit (no finalize)
5. `employee` — `/employee` only



### How a request is gated

1. `proxy.ts`
  - Public paths: `/`, `/login`, `/api/auth…`  
  - No session on `/admin` or `/employee` → redirect login  
  - Employee hitting `/admin` → `/employee`  
  - Staff on disallowed admin path → first allowed path  
  - `mustChangePassword` → `/change-password`
2. `lib/auth/session.ts`
  - `requireUser()`, `requirePermission("editPayroll")`, etc. inside actions
3. **UI**
  - Sidebar filters links with `canAccessAdminPath(role, href)`



### Auth files


| File                             | Role                             |
| -------------------------------- | -------------------------------- |
| `lib/auth/server.ts`             | Better Auth server config        |
| `lib/auth/client.ts`             | Browser auth client              |
| `lib/auth/permissions.ts`        | Role → permissions → path matrix |
| `app/api/auth/[...all]/route.ts` | HTTP auth endpoints              |


Demo logins (from seed): see `README.md` (`admin@oddo.com`, `john.cena@oddo.com`, …).

---



## 8. Database & Prisma



### Source of truth

- `prisma/schema.prisma` — models, enums, indexes  
- `prisma/migrations/` — applied SQL history  
- `generated/prisma/` — client generated by `prisma generate`

Generator output is configured as:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```



### Common domain tables (simplified)


| Area          | Models                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------- |
| Identity      | `user`, `session`, `account`, `employee_profile`, `organization`                            |
| Org structure | `department`, `working_schedule`, `contract`                                                |
| Time          | `attendance`, `leave_request`, `time_off_type`, `time_off_allocation`                       |
| Payroll       | `salary_structure`, `salary_rule`, `payrun`, `payslip`, `payslip_line` (+ legacy `payroll`) |
| Performance   | `performance_cycle`, `performance_review`, `performance_goal`                               |
| Recruitment   | `job_opening`, `candidate`                                                                  |
| AI / scale    | `org_metrics_snapshot`, `attendance_daily_rollup`, `background_job`                         |
| Comms         | `notification`, `copilot_conversation`, `copilot_message`                                   |




### Scripts you’ll use

```bash
npx prisma migrate deploy     # apply migrations
npx prisma generate           # rebuild generated/
npm run db:seed               # wipe + demo data
npm run db:repair             # fix inconsistent demo data (non-destructive)
npm run db:seed-employee-extras   # extra payslips/reviews for demo employees
npm run db:studio             # browse DB in browser
```



### Date rule (easy to get wrong)

Calendar dates are stored as `@db.Date` and handled as `YYYY-MM-DD` **keys** in Asia/Kolkata via `lib/shared/dates.ts` (`kolkataTodayKey`, `dateFromKey`, `inclusiveDayCount`).  
Don’t mix local midnight `Date` objects carelessly — you’ll get off-by-one days.

---



## 9. Domain walkthroughs



### Attendance

1. Employee clocks in → `clockInAction` in `lib/actions/people/attendance.ts`
2. Writes/updates `attendance` for today
3. UI shows live H:M:S timer from `checkInAt` ISO
4. Admin list is paginated/filtered; employee list sorts/filters client-side
5. Scale path: `attendance_daily_rollup` + job handlers under `lib/jobs/handlers/`



### Leave

1. Employee applies → `applyLeaveAction`
2. Validates dates (`validateLeaveDates`), overlaps, allocations
3. Admin approves → may decrement allocation / paid balance + mark attendance `leave`
4. Types requiring allocation: Paid, Comp Off (`time_off_allocation`)



### Payroll

1. Rules live in `salary_rule` / `lib/payroll/compute.ts`
2. Admin creates **payrun** → compute job creates **payslips**
3. Employees only see `validated` / `paid` slips (`listMyPayslips`)
4. Legacy table `payroll` still exists for some older AI/net paths



### Performance

1. HR creates **cycle** → reviews per employee
2. Status: `draft` → `submitted` → `acknowledged`
3. Employees only see submitted/acknowledged (`listMyPerformance`)
4. Goals have progress % editable by employee until acknowledged



### AI Analytics & Copilot

1. Metrics built into snapshots (`lib/ai/build-snapshot.ts`, jobs)
2. GET analytics prefers `org_metrics_snapshot` (scale)
3. Copilot widget: `components/ai/copilot-widget.tsx` → `lib/actions/ai.ts`
4. Insights cards need `OPENAI_API_KEY`; numbers can still compute without it



### Background jobs

- Queue model: `BackgroundJob`  
- Runner: `GET /api/cron/jobs` (needs `CRON_SECRET`)  
- Handlers: payrun compute, AI snapshot rebuild, attendance rollup backfill

---



## 10. How to find code fast


| I want to…                          | Start here                                   |
| ----------------------------------- | -------------------------------------------- |
| Change a screen URL / layout        | `app/...`                                    |
| Change a button’s behavior          | `*-client.tsx` → find the imported `*Action` |
| Change server rules                 | `lib/actions/...` then `lib/{domain}/...`    |
| Change who can open a page          | `lib/auth/permissions.ts` + `proxy.ts`       |
| Change a table/column               | `prisma/schema.prisma` → migrate             |
| Change colors / page chrome         | `DESIGN.md` + `app/globals.css`              |
| Seed demo users                     | `prisma/seed.ts`                             |
| Understand API for external clients | `lib/api/v1/operations.ts` + `/swagger-ui`   |


Search tip: grep the action name (e.g. `applyLeaveAction`) — UI and tests both point at it.

---



## 11. Local run loop

```bash
# 1. Env
cp .env.example .env   # set DATABASE_URL, etc.

# 2. Install + client
npm install            # also runs prisma generate

# 3. DB
npx prisma migrate deploy
npm run db:seed

# 4. App
npm run dev            # http://localhost:3000
```

Useful tests:

```bash
npm test
```

---



## 12. Design / product rules (short)

From `DESIGN.md` and workspace brand rules:

- Primary actions: **zinc near-black**, not blue  
- App pages: full-width card shell with `rounded-2xl` + border  
- Charts: grayscale zinc only  
- Font: Geist; icons: `components/icons` + Lucide sparingly  
- Don’t invent a second visual language on `/admin` or `/employee`

---



## 13. Docs map (when to read what)


| Doc                              | Use when                                  |
| -------------------------------- | ----------------------------------------- |
| **This file** (`docs/relearn/…`) | Learning the whole system                 |
| `docs/BACKEND.md`                | Deeper backend / action inventory         |
| `docs/database-schema.md`        | Schema notes                              |
| `docs/plans/*`                   | Feature / scale / AI implementation plans |
| `docs/evaluation-database-qa.md` | Manual QA checklist by page               |
| `DESIGN.md`                      | UI rules                                  |
| `README.md`                      | Setup + seed logins                       |


---



## 14. Practice path (recommended)

1. Log in as **employee** → clock in → watch timer → attendance filters.
2. Request leave → log in as **admin** → approve → see balance/attendance change.
3. Open **AI Analytics** as admin/HR manager.
4. Trace one click in the code: button → action → Prisma model.
5. Read `lib/auth/permissions.ts` and predict which sidebar items each role sees.

When something breaks, ask: **proxy?** → **permission in action?** → **validation?** → **DB constraint?** → **UI mapping?**

---

*Generated for relearning this repo. Prefer updating this file when folder structure or major flows change.*