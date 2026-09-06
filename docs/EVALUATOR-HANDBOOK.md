# PeoplePay360 / HRMS — Evaluator handbook

**Audience:** Oral exam / jury. Open this file first. Deeper tables live in the linked docs at the end.

**Product names:** The UI wordmark is **HRMS**. The demo tenant is **Odoo** (`organization.slug = ODOO`). Internal docs often say **PeoplePay360**. Same app.

**Scale lock:** One organization, ~5,000 employees target, one PostgreSQL primary. **Not** multi-tenant SaaS. **Not** a separate Express/FastAPI server.

**Timezone for all “today / late / calendar” logic:** `Asia/Kolkata` (`lib/shared/dates.ts`). Late cutoff if no schedule line: **09:15 IST**.

**Honesty rule for answers:** If a feature is stubbed or planned only, say so. Claiming Postgres RLS, Redis as a session/job store, or a working admin Settings save will fail a follow-up.

---



## Outline

1. [What this product is](#1-what-this-product-is)
2. [Architecture in 60 seconds](#2-architecture-in-60-seconds)
3. [Tools and technologies](#3-tools-and-technologies)
4. [How to run a demo](#4-how-to-run-a-demo)
5. [Roles, permissions, route protection](#5-roles-permissions-route-protection)
6. [Feature catalog (every screen)](#6-feature-catalog-every-screen)
7. [Domain engines (the “why” behind the UI)](#7-domain-engines-the-why-behind-the-ui)
8. [AI: analytics, insights, copilot, leave brief](#8-ai-analytics-insights-copilot-leave-brief)
9. [REST API and Swagger](#9-rest-api-and-swagger)
10. [Database: models, IDs, constraints, ACID](#10-database-models-ids-constraints-acid)
11. [Edge cases and business rules](#11-edge-cases-and-business-rules)
12. [Website / app performance work](#12-website--app-performance-work)
13. [Jobs, cron, mail, notifications](#13-jobs-cron-mail-notifications)
14. [Fault tolerance (what exists vs planned)](#14-fault-tolerance-what-exists-vs-planned)
15. [UI system and UX details](#15-ui-system-and-ux-details)
16. [Tests](#16-tests)
17. [What is NOT implemented](#17-what-is-not-implemented)
18. [Likely evaluator Q&A](#18-likely-evaluator-qa)
19. [Where to look next](#19-where-to-look-next)

---



## 1. What this product is

An internal **Human Resource Management System** for one company:


| Area          | What staff can do                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Identity      | Email/password login, forced first-password change, role-based portals                           |
| People        | Departments, working schedules, employee hub, spreadsheet import, contracts                      |
| Time          | Clock in/out, attendance logs, leave types, allocations, apply/approve leave                     |
| Payroll       | Salary structures + sequenced rules, payruns, compute/validate/mark paid, payslips, email, print |
| Performance   | Review cycles, ratings, goals, employee acknowledge                                              |
| Recruitment   | Job openings + candidate pipeline (demo-seeded applicants)                                       |
| Notifications | In-app inbox, announcements, email prefs                                                         |
| AI            | Org health KPIs, insight cards, HR copilot, leave-approver brief                                 |
| Developers    | Session-cookie REST API + Swagger UI                                                             |


Two portals:

- `/admin` — staff (admin, HR manager, payroll user, payroll manager)
- `/employee` — self-service (any signed-in user; employees are redirected here from `/admin`)

Public marketing landing is `/`. Companies can **register an organization** at `/sign-up` (self-serve tenant). Employees are still invited by that org’s admin.

---



## 2. Architecture in 60 seconds

```
Browser (app/**, components/**)
        │
        ▼
proxy.ts          cookie session + path ACL (pages only; /api is excluded)
layouts           requireStaffPage / requirePageUser
        │
        ▼
lib/actions/**    Next.js Server Actions  →  { ok: true, data } | { ok: false, error }
        │
        ├── lib/auth/**      Better Auth + RBAC
        ├── lib/people/**    leave / attendance / contract / schedule math
        ├── lib/payroll/**   salary formula engine (no eval)
        ├── lib/ai/**        metrics, sanitize, copilot planner, SQL lookups
        ├── lib/jobs/**      Postgres-backed job queue
        └── lib/db.ts        Prisma 7 + @prisma/adapter-pg
                │
                ▼
PostgreSQL  (schema in prisma/schema.prisma, SQL in prisma/migrations/)
```

**There is no separate backend process.** Mutations go through `"use server"` files. HTTP REST (`/api/v1`) is a thin catalog that calls the **same** actions. Redis is optional and only shares rate-limit counters across Node processes.

Better Auth HTTP handlers live at `app/api/auth/[...all]/route.ts`.

Generated Prisma client is `generated/prisma/` (do not hand-edit). Alias: `@/generated/prisma/client`.

---



## 3. Tools and technologies



### 3.1 Runtime stack


| Piece               | Choice                                                     | Why / where                                                                     |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| App framework       | **Next.js 16.2.10** App Router                             | RSC pages, Server Actions, `proxy.ts` (Next 16 replacement for `middleware.ts`) |
| UI library          | **React 19.2.4**                                           | Client components for tables, forms, copilot                                    |
| Language            | **TypeScript 5**                                           | Strict types across `app/` and `lib/`                                           |
| Database            | **PostgreSQL 16+**                                         | Source of truth; local demo often port **5433**, DB name `PeoplePay360`         |
| ORM                 | **Prisma 7.10** + `@prisma/adapter-pg` + `pg`              | Prisma 7 driver adapter (not the old query engine URL-only client)              |
| Auth                | **Better Auth 1.7**                                        | Email/password, httpOnly cookies, Prisma adapter, `disableSignUp: true`         |
| Validation          | **Zod 4**                                                  | `lib/shared/validations.ts` + API bodies                                        |
| Dates               | `Intl` + `lib/shared/dates.ts`                             | Kolkata calendar keys, not `Date` local TZ                                      |
| Mail                | **Nodemailer 10**                                          | New-user credentials + payslips (`lib/shared/mail.ts`)                          |
| AI SDK              | **Vercel AI SDK (**`ai`**)** + `@ai-sdk/openai`            | Optional `gpt-4o-mini` for insights, chat phrasing, tool *choice*               |
| Spreadsheets        | **xlsx 0.18**                                              | Employee import; **dynamic** `import()` so it is not on every page              |
| Charts              | **Recharts 3**                                             | Admin home (lazy), analytics, performance, recruitment, employee dashboard      |
| HTTP docs           | **swagger-ui-dist / swagger-ui-react**                     | `/swagger-ui`                                                                   |
| Avatars             | **Dicebear** Notionists                                    | Deterministic SVG from name seed (`lib/shared/notion-avatar.ts`)                |
| Toasts              | **Sonner**                                                 | Success/error after actions                                                     |
| Command palette     | **cmdk**                                                   | ⌘K navigation (`components/layout/command-palette.tsx`)                         |
| Calendar            | **react-day-picker**                                       | Date fields                                                                     |
| Animation           | **Motion 12**                                              | **Landing only** — in-app pages stay quiet                                      |
| Icons               | Custom `components/icons` + **Lucide**                     | Sidebar uses custom icons; do not replace them with Lucide                      |
| Fonts               | **Geist Sans / Geist Mono** (`next/font/google`)           | `app/layout.tsx`                                                                |
| CSS                 | **Tailwind CSS 4** + **tw-animate-css**                    | Tokens in `app/globals.css`                                                     |
| Component kit       | **shadcn** (`base-nova`, RSC) + **@base-ui/react**         | `components/ui/`*                                                               |
| Class names         | **clsx**, **tailwind-merge**, **class-variance-authority** | `cn()`                                                                          |
| Analytics (hosting) | **@vercel/analytics**                                      | Root layout                                                                     |
| Redis (optional)    | **`redis` 6** client                                       | Shared rate-limit counters only (`REDIS_URL`). Sessions and jobs stay in Postgres |
| Tests               | **Node test runner** via **tsx**                           | `npm test` — unit tests, not Playwright e2e                                     |
| Lint                | **ESLint 9** + `eslint-config-next`                        | `npm run lint`                                                                  |


Installed but **not used as a data layer**:


| Package                   | Reality                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ |
| **@tanstack/react-query** | `QueryProvider` is mounted in `AppChrome`. **Zero** `useQuery` / `useMutation` |
| **zustand**               | In `package.json`. **No stores** in the app                                    |




### 3.2 Next.js 16 specifics

- Request gate file is `proxy.ts`, exporting `proxy(request)`, not `middleware.ts`.
- `"use server"` files may export **only async functions**.
- Prisma packages are marked `serverExternalPackages` in `next.config.ts` so they are not bundled into the client.



### 3.3 Environment variables (`.env.example`)


| Variable              | Required | Purpose                                                                                       |
| --------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Yes      | Postgres                                                                                      |
| `BETTER_AUTH_SECRET`  | Yes      | Session signing (≥ 32 chars)                                                                  |
| `BETTER_AUTH_URL`     | Yes      | Canonical origin for auth                                                                     |
| `NEXT_PUBLIC_APP_URL` | Yes      | Public URL / auth client                                                                      |
| `SMTP_*`              | For mail | User-create emails + payslips                                                                 |
| `CRON_SECRET`         | For cron | `/api/cron/jobs` and `/api/cron/payslips`                                                     |
| `OPENAI_API_KEY`      | Optional | Insight cards, copilot phrasing, leave-brief LLM. **Metrics and SQL lookups work without it** |
| `REDIS_URL`           | Optional | Shared rate-limit counters. Without it, limits are in-memory per Node process. **Not** used for sessions, jobs, or dashboard cache |
| `PG_POOL_MAX`         | Optional | Override pool size (default 10 dev / 20 prod)                                                 |


Never commit `.env`.

---



## 4. How to run a demo

```bash
cp .env.example .env          # fill DATABASE_URL + BETTER_AUTH_SECRET
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                   # http://localhost:3000
```



### Seed logins

Staff password for demo employees: `Employee@1234`. Admin is separate.


| Role            | Email                     | Password          | Portal                                                     |
| --------------- | ------------------------- | ----------------- | ---------------------------------------------------------- |
| Admin           | `admin@odoo.com`          | `admin@odoo@1234` | `/admin`                                                   |
| HR Manager      | `william.joseph@odoo.com` | `Employee@1234`   | `/admin` (no payroll, has AI + performance)                |
| Payroll manager | `kimi.nowa@odoo.com`      | `Employee@1234`   | `/admin` (can finalize payruns; **no** AI analytics)       |
| Payroll officer | `priya.shah@odoo.com`     | `Employee@1234`   | `/admin` (edit/compute/send; **cannot** mark paid)         |
| Employee (demo) | `aarav.mehta@odoo.com`    | `Employee@1234`   | `/employee` — wage ₹50,000 → net ₹75,000 on Regular Salary |


Other seeded people: `bruce.banner@odoo.com`, `sarah.mills@odoo.com`, `john.cena@odoo.com`, `mark.lou@odoo.com`.

**Payroll talking point:** Aarav Mehta, Regular Salary structure:

`BASIC = 100% wage (50,000)` → `HRA = 40% basic (20,000)` → `STD = 10,000` → `GROSS = 80,000` → `PF 3,000` + `PT 2,000` → `NET = 75,000`.

Rules live in `lib/payroll/regular-salary.ts`. Engine: `lib/payroll/compute.ts`.

---



## 5. Roles, permissions, route protection



### 5.1 Roles

Postgres enum `Role` and Better Auth `user.role` (TEXT). Permissions read `user.role` (`lib/auth/permissions.ts`). Profile also has a `role` column — they are supposed to stay in sync (DB redesign Task 8 would make `user` the only writer; **not done yet**).


| Role                 | Admin people | Payroll                                        | AI analytics / copilot | Performance | Create users             |
| -------------------- | ------------ | ---------------------------------------------- | ---------------------- | ----------- | ------------------------ |
| `admin`              | yes          | all                                            | yes                    | yes         | **yes (only this role)** |
| `hr_manager`         | yes          | **no**                                         | yes                    | yes         | no                       |
| `hr_payroll_manager` | yes          | view/edit/**finalize**/salary CRUD             | **no**                 | **no**      | no                       |
| `hr_payroll_user`    | yes          | view/edit, view salary config, **no finalize** | **no**                 | **no**      | no                       |
| `employee`           | no           | own payslips only                              | no                     | own reviews | no                       |


Permission names: `viewAdminDashboard`, `managePeople`, `approveLeave`, `manageTimeOffTypes`, `viewPayrollAll`, `editPayroll`, `finalizePayroll`, `viewSalaryConfig`, `manageSalaryConfig`, `createUsers`, `viewAiAnalytics`, `managePerformance`, `adminExtras`.

### 5.2 Four gates (say this if asked “how are routes protected?”)

1. `proxy.ts` — Better Auth `getSession` from cookie. Unauthenticated `/admin` or `/employee` → `/login?next=…`. Employees hitting `/admin` → `/employee`. Staff hitting an admin URL they cannot use → `firstAllowedAdminPath`. `mustChangePassword` → `/change-password`. Matcher **excludes** `/api/`**.
2. **Layouts** — `app/admin/layout.tsx` → `requireStaffPage()`. `app/employee/layout.tsx` → `requirePageUser()`. Role is **re-read from Postgres**, not only the cookie (cookie cache is 5 minutes).
3. **Path ACL** — `canAccessAdminPath(role, pathname)` maps URL prefixes to permissions. Same function hides sidebar + command-palette items.
4. **Server Actions** — `requireUser()` / `requirePermission("…")` in `lib/auth/session.ts`. This is the **real** ACL. A hidden nav link does not grant writes.

REST `/api/v1` maps `AuthError` → **401**, `ForbiddenError` → **403**. Cron uses `CRON_SECRET`, not the user cookie.

**Staff can still open** `/employee`**.** Employees cannot open `/admin`.

Unknown `/admin/*` URLs (recruitment extras, etc.) fall through to `adminExtras` → **admin only**, except notifications/settings which any staff can open.

`/admin/users` was **removed**. New accounts: **People → Employees → Add User**.

Full path map: `lib/auth/permissions.ts`. Tests: `lib/auth/permissions.test.ts`.

---



## 6. Feature catalog (every screen)

Status: **Wired** = Prisma. **Partial** = DB with a gap. **Stub** = UI only / mock.

### 6.1 Public / auth


| Route              | Status         | What it does                                                                     |
| ------------------ | -------------- | -------------------------------------------------------------------------------- |
| `/`                | Marketing stub | Landing screenshots, fake “10k+ / 99.9%” stats. Not live product metrics.        |
| `/login`           | Wired          | `signInAction` → Better Auth `signInEmail`. Redirect by role / password flag.    |
| `/change-password` | Wired          | Forced after admin-created accounts (`mustChangePassword`).                      |
| `/logout`          | Wired          | `signOutAction`. Proxy skips session lookup so logout still works if DB is slow. |
| `/sign-up`         | Wired          | Creates `organization` + founding **admin** + bootstrap (HR dept, schedule, leave types, Regular Salary). Signs in. Better Auth `disableSignUp` stays true — we create the user ourselves. |




### 6.2 Admin — People


| Route                             | Status | Functionality                                                                                                |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `/admin`                          | Wired  | Headcount, attendance today/week, pending leave, department pie. Payroll KPI strip only if `viewPayrollAll`. |
| `/admin/people/employees`         | Wired  | Paginated list + kanban, search/filter/sort in URL. **Add User** (`createUsers`). **xlsx import**.           |
| `/admin/people/employees/[id]`    | Wired  | Employee hub: identity, department, manager, schedule, status, job title.                                    |
| `/admin/people/department`        | Wired  | Create/rename/delete. Cannot delete a dept that still has people (FK Restrict). Move members.                |
| `/admin/people/schedules`         | Wired  | Weekly lines (weekday 1–7 ISO). Expected hours = work window minus break.                                    |
| `/admin/people/contracts`         | Wired  | Running/expired, wage, optional dept/schedule/salary structure. One overlapping **running** contract.        |
| `/admin/people/contracts/[id]`    | Wired  | Edit one contract.                                                                                           |
| `/admin/people/attendance`        | Wired  | Org logs, date window, filters, pagination. Admin upsert.                                                    |
| `/admin/people/attendance/[id]`   | Wired  | Edit one day.                                                                                                |
| `/admin/people/leave`             | Wired  | Inbox: apply for someone, approve/reject, **AI leave brief**.                                                |
| `/admin/people/leave/allocations` | Wired  | Yearly buckets per employee × type. Approve/refuse allocation.                                               |
| `/admin/people/leave/types`       | Wired  | Paid/sick/unpaid-style types; `requiresAllocation` flag.                                                     |


Employee business code: `ODOO-2026-008` from `lib/people/employee-id.ts` (`slug-year-seq`). Unique **per organization**, not globally.

### 6.3 Admin — Payroll (live path)


| Route                                   | Status | Functionality                                                                                                                                                                    |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/hr/payroll`                     | Wired  | Payrun list. Wizard: structure + period → pick employees → create.                                                                                                               |
| `/admin/hr/payroll/[id]`                | Wired  | **Compute** (job) → **Validate** (blocked if missing covering contract) → **Mark paid** (`finalizePayroll`) → **Send payslips**. Warnings: no contract, missing bank, duplicate. |
| `/admin/hr/payroll/payslips`            | Wired  | List **without** line items (detail has lines). Email.                                                                                                                           |
| `/admin/hr/payroll/payslips/[id]`       | Wired  | Lines from last compute.                                                                                                                                                         |
| `/admin/hr/payroll/payslips/[id]/print` | Wired  | Printable HTML. Employees have **no** print route.                                                                                                                               |
| `/admin/hr/payroll/structures`          | Wired  | CRUD. Payroll user is read-only (`manageSalaryConfig`).                                                                                                                          |
| `/admin/hr/payroll/rules`               | Wired  | Ordered rules: fixed, % of wage/basic/gross, % of another code, formula.                                                                                                         |


**Legacy** table `payroll` (one row per user per month) still exists. UI is payruns. Orphan client: `payroll-client.tsx`. Do not demo it as the live path.

### 6.4 Admin — Performance, recruitment, AI, chrome


| Route                   | Status      | Functionality                                                                                                                       |
| ----------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/hr/performance` | Wired       | Cycles (open/close), reviews (draft → submit), goals 0–100%, ratings.                                                               |
| `/admin/hr/recruitment` | **Partial** | Create jobs, move stages, reject, schedule interview. **No “add applicant” action.** Board **auto-seeds demo candidates** if empty. |
| `/admin/analytics`      | Wired       | Health score, attendance/late/leave, flight-risk table, optional insight cards. Admin + HR manager only.                            |
| `/admin/notifications`  | Wired       | Inbox, mark read, delete, prefs, **announcements** (staff). Sounds flag stored, **no audio player**.                                |
| `/admin/settings`       | **Stub**    | Org/security/billing tabs, mock sessions/invoices, toast “saved” — **does not write Postgres**.                                     |
| `/admin/developers`     | **Removed** | Use `/swagger-ui`.                                                                                                                  |
| `/admin/users`          | **Removed** | Use Add User on Employees.                                                                                                          |




### 6.5 Employee portal


| Route                     | Status | Functionality                                     |
| ------------------------- | ------ | ------------------------------------------------- |
| `/employee`               | Wired  | Personal KPIs + clock.                            |
| `/employee/profile`       | Wired  | Read profile; **phone** is the editable field.    |
| `/employee/attendance`    | Wired  | Own logs (read). Clock is navbar widget.          |
| `/employee/leave`         | Wired  | Apply leave, calendar markers, remaining balance. |
| `/employee/payroll`       | Wired  | Own validated/paid payslips.                      |
| `/employee/performance`   | Wired  | Goal progress + acknowledge submitted reviews.    |
| `/employee/notifications` | Wired  | Same inbox client; **no announce**.               |
| `/employee/settings`      | Wired  | Account + change password (not the admin mock).   |




### 6.6 Chrome (all signed-in app pages)


| Feature         | Where                                     | Notes                                                                            |
| --------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Sidebar         | `components/layout/sidebar.tsx`           | Filtered by `canAccessAdminPath`. Dark mode: `html.dark` + `localStorage.theme`. |
| Navbar          | `components/layout/navbar.tsx`            | Attendance clock widget, notifications dropdown, command trigger.                |
| Command palette | `command-palette.tsx`                     | Client navigation only.                                                          |
| Copilot FAB     | `copilot-widget.tsx` via `app-chrome.tsx` | Only if `viewAiAnalytics`. Confirm/Cancel for writes.                            |


---



## 7. Domain engines (the “why” behind the UI)

Keep this list for “where is the business logic?” — **not** inside React.


| File                               | Job                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `lib/people/leave-rules.ts`        | Date order, sick-may-start-today, overlap of pending/approved, paid-day count    |
| `lib/people/time-off-balance.ts`   | `remaining = allocated − taken` (2 dp); overdraw gate                            |
| `lib/people/attendance-metrics.ts` | Late vs schedule+grace, worked hours, OT, missing checkout                       |
| `lib/people/contract-period.ts`    | Single overlapping **running** contract; pick covering contract for a pay period |
| `lib/people/schedule-hours.ts`     | Unique weekday lines; weekly expected hours                                      |
| `lib/people/employee-id.ts`        | `ODOO-2026-NNN`, `CON/YYYY/NNNN`                                                 |
| `lib/payroll/compute.ts`           | Ordered rules, formula sandbox (**no** `eval`)                                   |
| `lib/payroll/warnings.ts`          | Priority: no contract > missing A/C > duplicate                                  |
| `lib/ai/metrics.ts`                | Attendance %, late %, clash count, flight risk, health score                     |
| `lib/ai/sanitize.ts`               | Strip names/wages/bank before any model call                                     |
| `lib/shared/errors.ts`             | Map Prisma codes to public strings                                               |


---



## 8. AI: analytics, insights, copilot, leave brief

**Who:** `viewAiAnalytics` = **admin + hr_manager only**. Payroll roles and employees cannot open `/admin/analytics` or the FAB.

**Mental model:** Postgres is truth. Formulas are TypeScript. The LLM may **phrase** or **choose a tool**. It must not invent counts or write SQL.

### 8.1 Workforce analytics (`/admin/analytics`)

1. `getAiAnalytics` (`lib/actions/ai.ts`) loads `OrgMetricsSnapshot` kind `ai_analytics`.
2. If older than ~6 hours, enqueues `ai_snapshot_rebuild` (`lib/jobs/handlers/ai-snapshot.ts`).
3. Snapshot is built by `lib/ai/build-snapshot.ts` from employees, attendance, leave, payroll aggregates, review aggregates.
4. Formulas in `lib/ai/metrics.ts`:
  - **Attendance rate:** `(present + 0.5×halfDays) / expectedDays × 100`
  - **Late rate:** check-in after schedule start + grace, else 09:15 IST
  - **Leave clashes:** pairwise overlapping leave in the **same department** (metric only, not a write block)
  - **Flight risk 0–100:** attendance drop, sick/unpaid days, leftover paid leave + drop, tenure <90d or >540d
  - **Health 0–100:** attendance (40) + pending leave (25) + inactive % (20) + payrun warnings (15) → bands `healthy` (≥80) / `watch` (≥55) / `at_risk`

Numbers work **without** `OPENAI_API_KEY`.

### 8.2 Insight cards (optional LLM)

`generateAiInsights` → `toModelSnapshot` (no names/wages/bank) → `gpt-4o-mini` JSON → `mapInsightCards` allowlists hrefs (`/admin/people/leave`, attendance, employees, payroll, performance, analytics). Stored in `ai_insight`, ~6h TTL. Button fails closed if no API key.

### 8.3 HR copilot (assistant)

**UI:** FAB. History + new chat. Confirm / Cancel.

**Flow:**

```
askHrCopilot
  → planAssistantTurn (regex in lib/ai/copilot.ts)
  → if still "chat" and OpenAI on: planCopilotTurn (model picks a tool, does not answer with numbers)
  → lookup  → executeAssistantLookup → parameterized SQL (lib/ai/copilot-query.ts)
  → act     → pendingAction on CopilotConversation until Confirm
  → Confirm → executeAssistantPlan → existing people/leave/attendance actions
  → refuse  → wages, bank, passwords, PIPs, jailbreaks, named salary
```

**Lookups (SQL, org-scoped):** headcount, departments, people, person, leave balance, reports-to, attendance exceptions, leave today, pending leave, attendance summary, payroll **net** (needs `viewPayrollAll`, no named wages), performance averages, org overview.

**Writes after Confirm:** create/rename/delete department; add/move/title/deactivate employee; apply/approve/reject leave; mark attendance; clock in/out. Informal hire asks for **email first**.

**Not in copilot:** jobs/candidates, contracts, schedules, allocations, announcements, payrun compute/email, batch approve, import, undo, CSV, creating review cycles.

Persistence: `CopilotConversation` / `CopilotMessage`. Probe: `npx tsx lib/ai/copilot-capability.probe.ts`.

### 8.4 Leave brief

On the leave board, `approveLeave` users can `summarizeLeaveForApprover`. Deterministic clash count + paid remaining. If OpenAI is set, bullets + `approve` / `review` / `reject` **suggestion only** — it does not decide the leave.

---



## 9. REST API and Swagger


| URL                    | What                                          |
| ---------------------- | --------------------------------------------- |
| `/api/v1/...`          | Versioned API; same session cookie as the app |
| `/api/v1/openapi.json` | OpenAPI document                              |
| `/swagger-ui`          | Swagger UI (staff session required)           |
| `/api/docs`            | Redirects to `/swagger-ui`                    |
| `/api/auth/[...all]`   | Better Auth                                   |
| `/api/cron/jobs`       | Background worker (`CRON_SECRET`)             |
| `/api/cron/payslips`   | Month-end payslip send (`CRON_SECRET`)        |


Catalog: `lib/api/v1/operations.ts`. Dispatch: `lib/api/v1/dispatch.ts`. Health: `GET /api/v1/health` returns `{ service, version }` — **does not ping Postgres**.

Operations cover me/profile, dashboards, departments, employees, schedules, contracts, attendance (incl. clock), leave, types, allocations, payruns/payslips/salary, performance, recruitment, notifications, AI copilot/analytics/brief.

---



## 10. Database: models, IDs, constraints, ACID

**Do not mix IDs:**


| ID                            | Table              | Meaning                                              |
| ----------------------------- | ------------------ | ---------------------------------------------------- |
| `user.id`                     | `user`             | Login. Attendance + leave historically hang on this. |
| `employee_profile.id`         | `employee_profile` | HR PK. Contracts, allocations, payslips, reviews.    |
| `employee_profile.employeeId` | same               | **Badge** `ODOO-2026-008`, not a FK.                 |


After Task 4, `attendance` and `leave_request` also store `organizationId` + `employeeId` (**profile PK**, not the badge). Triggers require them to match the profile. Copilot SQL can filter by org without joining `user`.

**Tenant:** one `organization` row (Odoo). App scopes queries by `organizationId`. **No Postgres RLS.**

### 10.1 Model groups


| Domain         | Models                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Auth           | `User`, `Session`, `Account`, `Verification`                                                          |
| Org            | `Organization`, `Department`, `WorkingSchedule`, `WorkingScheduleLine`, `EmployeeProfile`, `Contract` |
| Time           | `Attendance`, `LeaveRequest`, `TimeOffType`, `TimeOffAllocation`                                      |
| Payroll live   | `SalaryStructure`, `SalaryRule`, `Payrun`, `Payslip`, `PayslipLine`                                   |
| Payroll legacy | `Payroll`                                                                                             |
| Performance    | `PerformanceCycle`, `PerformanceReview`, `PerformanceGoal`                                            |
| Recruitment    | `JobOpening`, `Candidate`                                                                             |
| AI             | `AiInsight`, `CopilotConversation`, `CopilotMessage`, `OrgMetricsSnapshot`                            |
| Scale          | `AttendanceDailyRollup`, `BackgroundJob`                                                              |
| Comms          | `Notification`, `NotificationPreference`                                                              |


FK cheat sheet (ON DELETE + UI file): `docs/evaluation-database-qa.md`. Column catalog: `docs/database-schema.md`.

### 10.2 What “ACID” means here

PostgreSQL already gives **A**tomic transactions, **C**onsistency via constraints, **I**solation, **D**urability. The work we added is **constraints the app used to only check in TypeScript**:


| Task | Migration                                | What                                                                                                              |
| ---- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1    | catalog                                  | `docs/db/invariants.md` + `lib/db/invariants.ts`                                                                  |
| 2    | `20260906010000_check_constraints`       | Date order, duration ≥ 0, wage ≥ 0, checkout needs check-in, weekday 1–7, goal progress 0–100, …                  |
| 3    | `20260906020000_bcnf_unique_keys`        | Org-scoped employee badge, one allocation per employee/type/year, payrun period uniqueness, …                     |
| 4    | `20260906030000_fact_table_org_employee` | Org + employee on attendance/leave + match triggers                                                               |
| 5    | `20260906040000_leave_exclusion`         | `btree_gist` **EXCLUDE**: no two **approved** leaves for the same employee with overlapping inclusive `daterange` |


Exclusion errors (`23P01`) map to: *“Those dates overlap an approved leave.”*

**Not done (Tasks 6–14):** drop dual `paidLeaveBalance`; wage only on running contract; single role/name writer; recruitment stage history; payrun row-lock/`computing` status; `statement_timeout`/`lock_timeout`; drop legacy `payroll`; rebuildable `inactiveEmployeeCount`; automated EXPLAIN gates.

**Normalization answer:** BCNF-oriented unique keys + rebuildable rollups. Not 6NF. Dual columns still exist (wage, role, paid leave balance).

---



## 11. Edge cases and business rules

Use this section when they say “what happens if…”.

### 11.1 Leave


| If…                                      | Then…                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| End date before start                    | App + CHECK reject                                                                         |
| Paid leave starting today or in the past | Reject. **Sick may start today.**                                                          |
| New request overlaps pending or approved | App: `findOverlappingLeave`                                                                |
| Two **approved** ranges overlap (race)   | Postgres EXCLUDE rejects; public message                                                   |
| Type requires allocation                 | Need **approved** allocation and `duration ≤ remaining` (checked on apply **and** approve) |
| Approve                                  | `taken += duration`; each day upserted attendance `status=leave`, clocks cleared           |
| Reject a previously approved request     | `taken = max(0, taken − duration)`                                                         |
| Approver is the leave owner              | Self-approve banned                                                                        |
| Unpaid/sick                              | `paidLeaveDays` = 0; still subject to overlap rules                                        |




### 11.2 Attendance / clock


| If…                               | Then…                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Second clock-in same calendar day | Unique `(userId, date)` → “already checked in”                                     |
| Clock-out without check-in        | CHECK + app reject                                                                 |
| Check-out before check-in         | Reject                                                                             |
| Approved leave today              | Clock-in blocked; day is `leave`                                                   |
| Worked hours in (0, 5)            | Status `half_day`                                                                  |
| Yesterday still open punch        | “Missing checkout” in metrics                                                      |
| Late                              | Schedule line start + grace, else **09:15 IST**; staff may get a late notification |




### 11.3 Contracts / schedules / IDs


| If…                                    | Then…                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Two **running** contracts overlap      | App rejects (`assertSingleRunning`). **Not** a DB exclusion yet                     |
| `endDate` null                         | Treated as far-future for coverage                                                  |
| `endDate` < today on save              | Forced `expired`                                                                    |
| Two Monday lines on one schedule       | Unique `(scheduleId, weekday)`                                                      |
| Delete Engineering while people remain | FK **Restrict**                                                                     |
| Delete a manager who still has reports | Restrict until `managerId` cleared                                                  |
| New employee                           | Badge `ODOO-YYYY-NNN`; temp password; `mustChangePassword`; email or toast fallback |




### 11.4 Payroll


| If…                                             | Then…                                          |
| ----------------------------------------------- | ---------------------------------------------- |
| Formula contains `eval` / `process` / `require` | Parser throws `Unsafe formula.`                |
| Division by zero in formula                     | Result 0                                       |
| Missing % base                                  | 0                                              |
| No covering contract                            | Warning; **Validate is blocked**               |
| Missing bank                                    | Warning; does not block validate               |
| Duplicate payslip in another run                | Warning                                        |
| Payroll user clicks Mark paid                   | Forbidden (`finalizePayroll` is manager/admin) |
| HR manager opens `/admin/hr/payroll`            | Proxy redirects away                           |
| Same org+period+employeeType payrun twice       | Unique key                                     |


Demo identity: wage 50,000 → NET 75,000 on Regular Salary.

### 11.5 Auth / security


| If…                                   | Then…                                         |
| ------------------------------------- | --------------------------------------------- |
| Public Better Auth signup | Disabled (`disableSignUp`). **Organization registration** at `/sign-up` creates the tenant + first admin. |
| New hire first login                  | `/change-password` until flag cleared         |
| Employee types `/admin/analytics`     | Redirect `/employee`                          |
| Payroll user types `/admin/analytics` | Redirect to first allowed admin page          |
| Copilot asks “Priya’s salary”         | Refuse                                        |
| Copilot mutation                      | Must Confirm                                  |
| LLM snapshot                          | No names, wages, or bank numbers              |
| Prisma unique / timeout               | `publicActionError` — no raw SQL in the toast |




### 11.6 Performance reviews

Goal `progress` CHECK 0–100. One review per employee per cycle (unique). Copilot can **read** org average rating; it cannot create cycles or PIPs.

### 11.7 Import

xlsx parsed in `importEmployeesFromSpreadsheetAction`. Heavy `xlsx` module loaded only for that action.

---



## 12. Website / app performance work

**Goal they may quote:** ship a **page of rows** and **precomputed KPIs**, not the whole warehouse, at hundreds to ~5k employees.

### 12.1 What we actually shipped

**Server pagination (URL** `page` **/** `pageSize` **/ filters)** — employees, attendance, leave, allocations, contracts, payslips, recruitment applicants, performance, notifications. Helper: `lib/shared/pagination.ts`. UI: `components/ui/list-pagination.tsx`.

**Select less** — payrun **list** uses `_count` / `groupBy` for warning counts, not nested payslip arrays. Payslip **list** omits `lines` (lines on detail/print).

**Aggregate in SQL** — dashboards use `groupBy` / `_count` instead of loading every profile/attendance row into Node (admin home still uses some `groupBy` on attendance for the week chart).

**Tagged cache (**`unstable_cache`**)**


| Snapshot                 | TTL    | Tags                                          |
| ------------------------ | ------ | --------------------------------------------- |
| Admin home KPIs          | ~30s   | `employees`, `attendance`, `leave`, `payroll` |
| Employee directory stats | tagged | `employees`                                   |
| Payroll dashboard KPIs   | ~30s   | `payroll`                                     |


Mutations call `revalidateTag` / `revalidatePath`.

**Indexes** — employee list composites (`20260905220000_employee_list_indexes`), list/filter indexes (`20260905230000_perf_list_indexes`), fact-table org+date indexes, `BackgroundJob` claim indexes.

`pg_trgm` **GIN** on `employee_profile.fullName` and `employeeId` (SQL in scale-5k migration) so `ILIKE %q%` search does not full-scan as badly.

**Attendance daily rollup** — `AttendanceDailyRollup` unique per org+date. Recomputed after clock/upsert (`lib/jobs/handlers/attendance-rollup.ts`). Admin “present today” prefers the rollup.

**AI snapshot** — copilot/analytics reads `OrgMetricsSnapshot` instead of scanning all attendance/leave on every chat (rebuild job when stale).

**Payrun compute** — duplicate detection **batched** (no per-slip `findFirst` loop). Compute runs as `BackgroundJob` type `payrun_compute`.

**Pool** — `lib/db.ts`: `connectionTimeoutMillis: 5000`, `max` 10 (dev) / 20 (prod) or `PG_POOL_MAX`. Prisma client cached on `globalThis` in dev so hot reload does not leak pools.

**Bundle**

- Admin home Recharts via `dynamic(..., { ssr: false })` (`dashboard-lazy.tsx`)
- Command palette `dynamic()` in navbar
- `xlsx` dynamic import on import only
- Prisma/pg/swagger marked `serverExternalPackages`

**Avatars** — Dicebear SVG from a seed; not a round-trip image CDN per cell.

**Request timing** — `withTiming` on some hot actions; JSON logger (`lib/shared/logger.ts`).

### 12.2 What we did *not* finish (say this)

- TanStack Query is a provider only — lists are still RSC + `router.refresh`
- Zustand unused
- Redis is optional and **only** for rate limits (`REDIS_URL`). Sessions, `BackgroundJob`, and KPI snapshots stay in Postgres
- No virtualized 5k-row tables (by design: page on the server)
- Eligible-employee pickers and some department member lists can still load large sets
- Search is still ILIKE; trigram helps but is not a dedicated typeahead product
- `statement_timeout` / `lock_timeout` not set (fault-tolerance / DB Task 11)
- Recharts still on several client pages besides admin home
- Job types `payslip_bulk_email` and `employee_import_chunk` are **skipped** in the queue switch

Plans: `docs/plans/2026-09-05-performance-optimization.md`, `docs/plans/2026-09-05-scale-5k.md`.

---



## 13. Jobs, cron, mail, notifications



### 13.1 Job queue

Postgres table `BackgroundJob`. Code: `lib/jobs/queue.ts`.


| Type                         | Handler                         | Used?       |
| ---------------------------- | ------------------------------- | ----------- |
| `payrun_compute`             | `handlers/payrun-compute.ts`    | Yes         |
| `ai_snapshot_rebuild`        | `handlers/ai-snapshot.ts`       | Yes         |
| `attendance_rollup_backfill` | `handlers/attendance-rollup.ts` | Yes         |
| `payslip_bulk_email`         | —                               | **Skipped** |
| `employee_import_chunk`      | —                               | **Skipped** |


Claim uses a stale-lock window (~15 minutes). `enqueueAndRun` often runs **inline** in the request as well as enqueueing, so demo compute still finishes in the browser session.

Cron: `GET/POST /api/cron/jobs` with `Authorization: Bearer CRON_SECRET` or `?secret=`.

### 13.2 Mail

Nodemailer (`SMTP_HOST/PORT/USER/PASS/FROM`). Used for:

- Temporary password when admin creates a user (if SMTP fails, UI toast shows the password)
- Payslip send from payrun / payslip pages / month-end cron



### 13.3 Notifications

`lib/shared/notify.ts` writes `Notification` rows and optionally emails if prefs allow. Triggers include late clock-in, leave decisions, announcements, payslip delivery. Prefs: `NotificationPreference`. Sounds: boolean stored, **not played**.

---



## 14. Fault tolerance (what exists vs planned)

Plan: `docs/plans/2026-09-05-fault-tolerance.md`.


| Task                                     | Status                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| 1 Classify errors (`publicActionError`)  | **Done**                                                                         |
| 2 Request IDs                            | **Partial** — `X-Request-Id` on `/api/v1`; server actions do not always bind ALS |
| 3 Recover + not-found shells             | **Done** — `app/error.tsx`, `global-error.tsx`, `not-found.tsx`, `RecoverPanel`  |
| 4 Liveness vs readiness                  | Not done (health does not ping DB)                                               |
| 5 Statement/lock timeouts                | Not done (pool `max` only)                                                       |
| 6 Proxy fail-open if Postgres down       | Not done (`getSession` still hits DB)                                            |
| 7 SMTP/OpenAI timeouts, retry, circuit   | Not done                                                                         |
| 8 Claim payslip before send              | Not done (overlap can double-send)                                               |
| 9 Offline banner / copilot draft restore | Not done                                                                         |
| 10 Idempotency keys                      | Not done                                                                         |
| 11 Rate limits                           | **Done** — login/signup/reset/copilot + `/api/v1` (except `/health`). Redis if `REDIS_URL`, else per-process memory. Fail-open if Redis errors |
| 12 Operator checklist                    | Doc only                                                                         |


If they ask “what if the database is down at login?”: the proxy still needs a session lookup; there is **no** fail-open cached “allow” path. Logout is the exception (no session round-trip).

Rate limits: public auth and copilot are bounded even without Redis. Set `REDIS_URL` in production so two Node processes share the same counters. Redis outages fail open (request is allowed) so login cannot be taken down by the limiter.

---



## 15. UI system and UX details

Source of truth: `DESIGN.md`. Brand rule file: `.cursor/rules/hrms-brand.mdc`.

- Zinc / near-black primary (`bg-zinc-900`). **No blue CTAs** (`#1D4ED8` token exists but must not be used for app buttons).
- Page shell: `w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6`
- H1: `text-h1 font-medium`. Subtitle: `text-body-lg text-zinc-500 font-medium`
- Status color only on badges/deltas (emerald / amber / red)
- Charts: grayscale zinc gradients `#E4E4E7` → `#18181B`
- Dark mode: `zinc-*` remapped in `app/globals.css`; prefer `surface` / `text-primary` / `border` tokens
- No heavy table shadows, no centered in-app titles, no marketing motion on `/admin` or `/employee`
- Avatars: Dicebear Notionists
- Toasts: Sonner

---



## 16. Tests

```bash
npm test
```

Node’s test runner via `tsx --test` (see `package.json` `test` script). Coverage is **pure domain + permissions + AI + mail/errors**, not browser e2e.

Includes: leave-rules, permissions, payroll compute/warnings, attendance-metrics, contract-period, schedule-hours, time-off-balance, AI metrics/sanitize/snapshot/insights/copilot/query, mail, payslip-email, errors, logger, rate-limit, openapi, HTTP status mapping, db invariants.

Copilot routing probe (separate): `npx tsx lib/ai/copilot-capability.probe.ts`.

---



## 17. What is NOT implemented

Say these out loud if asked “is everything done?”


| Item                                       | Reality                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Admin Settings                             | Mock chrome, no DB                                                                  |
| Public registration                        | Closed                                                                              |
| `/admin/users`                             | Removed; Add User on Employees                                                      |
| Recruitment applicant intake               | No create-candidate UI; demo auto-seed                                              |
| Copilot write surface                      | People/leave/attendance only                                                        |
| LLM-authored SQL                           | Explicitly forbidden                                                                |
| Postgres RLS                               | App-level org filter + triggers                                                     |
| Multi-tenant SaaS                          | One org                                                                             |
| Redis                                      | Optional rate-limit store only — **not** sessions, queues, or cache                 |
| Websockets                                 | No                                                                                  |
| TanStack list cache / Zustand              | Installed unused                                                                    |
| Dual wage / dual role / `paidLeaveBalance` | Still present (Tasks 6–8)                                                           |
| Legacy `payroll` table                     | Not dropped                                                                         |
| Notification sounds                        | Flag only                                                                           |
| Employee payslip print                     | Admin print only                                                                    |
| Fault-tolerance 4–10, 12                   | See §14 (rate limits are done)                                                      |
| DB redesign 6–14                           | See §10.2                                                                           |
| README “Coming Soon” list                  | **Stale** — Performance, Notifications, Recruitment are wired (recruitment partial) |


---



## 18. Likely evaluator Q&A

**Q. Why Server Actions instead of REST?**  
The product UI uses Server Actions as the API. REST `/api/v1` was added so Swagger / external clients call the **same** functions. No second business layer.

**Q. Why Prisma 7 + adapter-pg?**  
Prisma 7 uses a driver adapter. We pass a `pg` pool (`PrismaPg`) so pool size and connect timeout are under our control (`lib/db.ts`).

**Q. Is the copilot RAG?**  
No. It is a **tool router** (regex, then optional LLM tool choice) plus **parameterized SQL**. Dashboard numbers are not an LLM rewrite of a snapshot.

**Q. How do you stop the model leaking wages?**  
Refuse prompts; `toModelSnapshot` strips names/wages/bank; payroll lookup requires `viewPayrollAll` and returns **net**, not named wages; Confirm before writes.

**Q. How did you make lists fast?**  
Server `skip`/`take` + URL state, indexes, `groupBy`, 30s tagged KPI cache, attendance rollups, AI snapshots, dynamic import of `xlsx`/charts, pg pool cap, trigram on name search.

**Q. What is BCNF work you actually shipped?**  
Org-scoped unique employee badge, unique allocations, unique payrun period, CHECKs, approved-leave exclusion. Dual columns remain.

**Q. Attendance vs leave IDs?**  
Leave/attendance `userId` → `user.id`. After Task 4 also `employeeId` → `employee_profile.id`. Badge `employee_profile.employeeId` is a string code.

**Q. Can HR Manager see payroll?**  
No. Permission + `canAccessAdminPath` + proxy redirect.

**Q. Can payroll see AI?**  
No.

**Q. Formula injection?**  
Custom parser, charset allowlist, banned identifiers. Never `eval`.

**Q. Overlapping leave approved twice?**  
App check plus Postgres `EXCLUDE USING gist`. Second approve fails even under a race.

**Q. Dark mode?**  
Client class on `<html>`, CSS variable remap. Not a separate theme package.

**Q. Why Next 16** `proxy.ts`**?**  
Framework convention replacing `middleware.ts` for the request interceptor.

---



## 19. Where to look next


| Need                             | File                             |
| -------------------------------- | -------------------------------- |
| This handbook                    | `docs/EVALUATOR-HANDBOOK.md`     |
| Backend folders + action catalog | `docs/BACKEND.md`                |
| FK oral-exam answers             | `docs/evaluation-database-qa.md` |
| Column-level schema notes        | `docs/database-schema.md`        |
| Invariants / CHECKs              | `docs/db/invariants.md`          |
| Visual system                    | `DESIGN.md`                      |
| Seed + local Postgres            | `README.md`                      |
| 5-minute payroll demo            | `docs/demo-walkthrough.md`       |
| Permissions matrix               | `lib/auth/permissions.ts`        |
| Prisma models                    | `prisma/schema.prisma`           |
| Copilot planner                  | `lib/ai/copilot.ts`              |
| Salary engine                    | `lib/payroll/compute.ts`         |
| Route gate                       | `proxy.ts`                       |


Team history (not required for the product story): Malay owned People/HR (`docs/plans/IMPLEMENTATION-MALAY.md`); Krishil owned Payroll (`IMPLEMENTATION-KRISHIL.md`).