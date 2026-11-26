# HRMS (PeoplePay360)

Human resource and payroll management for one or more companies: employees, departments, attendance, leave, payroll, performance, recruitment, notifications, and an AI analytics copilot.

Built with Next.js 16, PostgreSQL, Prisma 7, and Better Auth.

**Live demo:** https://hrms-main-mauve.vercel.app (demo logins below)

**Evaluator / jury notes:** [docs/EVALUATOR-HANDBOOK.md](docs/EVALUATOR-HANDBOOK.md) covers features, edge cases, performance work, and the stack.

## Prerequisites

- Node 20+ (tested on 24)
- PostgreSQL 16+ on the default port **5432** (tested on 18, not Docker)
- Redis (optional, recommended): shared rate-limit counters
- A Gmail account with an App Password (optional): credential, payslip, and password-reset emails
- A free Google Gemini API key or an OpenAI key (optional): AI insight cards and copilot

## Setup

```bash
# 1. Postgres on port 5432 (Postgres.app, the EDB installer, or Homebrew)
brew install postgresql@18 && brew services start postgresql@18

# 2. Role + database (once)
psql -h 127.0.0.1 -p 5432 -d postgres -c "CREATE ROLE postgres LOGIN PASSWORD 'admin123' SUPERUSER;"
psql -h 127.0.0.1 -p 5432 -d postgres -c 'CREATE DATABASE "PeoplePay360" OWNER postgres;'

# 3. Redis (optional)
brew install redis && brew services start redis

# 4. Environment
cp .env.example .env          # then fill in the values (see below)

# 5. Install, migrate, seed, run
npm install
npx prisma migrate deploy
npm run db:seed               # base company, ~300 staff, payroll, recruitment
npm run db:seed-more          # optional: +300 more employees
npm run db:seed-employee-extras
npm run db:demo-ready         # attendance up to today, approvals waiting, demo logins free to clock in
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The seed builds attendance and leave relative to **today**, so dashboards always have live data. Run `npm run db:demo-ready` on later days to bring it up to date, or re-run `npm run db:seed` to reset everything (it wipes the database).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | `postgresql://postgres:PASSWORD@localhost:5432/PeoplePay360` |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3000` locally |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | for email | Gmail SMTP. `SMTP_PASS` must be a [Google App Password](https://myaccount.google.com/apppasswords) (2-Step Verification on) |
| `MAIL_SKIP_DOMAINS` | no | Recipient domains that never get mail. Default `company.com` (the seeded demo accounts) |
| `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | no | Any OpenAI-compatible provider. Free option: Google Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/`, `gemini-3.5-flash-lite`, key from [AI Studio](https://aistudio.google.com/apikey)). Gemini's free tier may use prompts to improve Google products |
| `DEMO_MODE` | no | `true` enables the daily demo upkeep cron (`/api/cron/demo`) for the seeded `COMPANY` organization |
| `OPENAI_API_KEY` | no | OpenAI (`gpt-4o-mini`), used when `AI_API_KEY` is empty. Metrics work with no AI key at all |
| `REDIS_URL` | no | `redis://localhost:6379`. Without it, rate limits are per-process memory |
| `CRON_SECRET` | no | Protects `/api/cron/*`. Generate with `openssl rand -hex 32` |

Never commit `.env`.

## Seed logins

| Role | Email | Password | Lands on |
|------|-------|----------|----------|
| Admin | `admin@company.com` | `admin@company@1234` | `/admin`, everything |
| HR Manager | `william.joseph@company.com` | `Employee@1234` | `/admin`, people, leave, performance, AI (no payroll) |
| Payroll Manager | `kimi.nowa@company.com` | `Employee@1234` | `/admin`, payroll incl. mark paid (no AI) |
| Payroll User | `priya.shah@company.com` | `Employee@1234` | `/admin`, payroll edit/compute/send (cannot mark paid) |
| Employee | `john.cena@company.com` | `Employee@1234` | `/employee` |

More employees, all with password `Employee@1234`: `aarav.mehta@`, `bruce.banner@`, `mark.lou@`, `sarah.mills@`, and about 600 generated staff such as `ayaan.jain.008@company.com`.

New companies register at `/sign-up`; the founder becomes that company's admin. Inside a company, admins add people from **Employees → Add User**.

Demo accounts use `@company.com`, which is a real third-party domain, so the app never emails them (see `MAIL_SKIP_DOMAINS`). When an email is skipped, the new user's temporary password is shown on screen instead.

## Running a demo

Before a demo, run:

```bash
npm run db:demo-ready
```

It fills attendance up to today, keeps about 5% of staff on leave, and frees the demo logins to clock in live. It also leaves work waiting for you, and it is safe to run any time. On Vercel, set `DEMO_MODE=true` and `/api/cron/demo` does the same every morning (about 10:00 IST), so the live demo never goes stale.

What each login has to show:

| Login | Show |
|---|---|
| `john.cena@company.com` | Clock in / clock out (worked hours, half day under 5h), apply for leave, view payslips |
| `admin@company.com` | Dashboard, approve or reject pending leave, approve next year's leave allocations, run the current month's payrun (Compute → Validate), mark the validated payrun paid, recruitment pipeline (add applicant, move stages), AI Analytics and copilot, Settings |
| `william.joseph@company.com` | HR manager: people, leave approvals, performance reviews, AI (payroll is hidden) |
| `kimi.nowa@company.com` | Payroll manager: payruns, payslips, salary rules |

A suggested flow:
1. John clocks in.
2. John applies for leave.
3. The admin sees John on the dashboard and approves the leave.
4. The admin runs the month's payroll.
5. John opens his payslip.

Demo staff use `@company.com`, so the app never emails them. Payslip and credential emails show an on-screen notice instead. To demo email, add an employee with your own address.

## Features

All of these read and write PostgreSQL:

- **People:** employees, departments, working schedules, contracts, Excel import
- **Attendance:** clock in/out, manual corrections, daily rollups. Worked hours are clock-out minus the scheduled break; under 5 hours is a half day; time beyond the schedule is overtime
- **Leave:** time-off types, allocations, requests, approvals, balances
- **Payroll:** salary structures and rules, payruns (compute, validate, mark paid), payslips with print view and email
- **Performance:** review cycles, goals, employee self-assessment and manager reviews (nobody can be their own reviewer)
- **Recruitment:** job openings, adding applicants (duplicate emails per job and applications after the deadline are refused), and a candidate pipeline (drag between stages, interviews, reject)
- **Notifications:** in-app plus optional email, per-user preferences, announcements
- **AI Analytics** (admin and HR manager): live health metrics, AI insight cards, and an HR copilot that answers from the database and can take actions
- **Settings:** organization name and email (admin only), password change, and signed-in sessions with remote sign-out
- **REST API:** `/api/v1/*` with Swagger UI at `/swagger-ui`. It uses the same session cookie and permissions as the app

## Security model

- **Companies are isolated.** Every company-owned query is filtered by the signed-in user's organization (`requireOrgPermission` in `lib/auth/session.ts`). Lookups and edits by ID also check the organization, so an ID from another company returns "not found". There is no Postgres row-level security; isolation lives in the app layer.
- **Roles:** what each role can open and do is defined in `lib/auth/permissions.ts`, and the same rules apply to pages, server actions, and `/api/v1`.
- **Temporary passwords:** accounts created by an admin must change their password before any page, action, or API call works.
- **AI copilot:** answers come from fixed lookups or from a read-only SQL query. Every query runs against copies of the tables that hold only the asker's company and never include wages, bank details, addresses, or passwords (`lib/ai/sql-scope.ts`).
- **Email:** demo domains in `MAIL_SKIP_DOMAINS` never receive mail.

## Scheduled jobs

`/api/cron/payslips` emails validated payslips for the closing month (once per payslip, so daily runs are safe). `/api/cron/jobs` drains queued background jobs. `/api/cron/demo` keeps the demo company current (only when `DEMO_MODE=true`; see Running a demo). All need `Authorization: Bearer $CRON_SECRET`.

```bash
npm run cron:payslips          # this month (or the last one, before month end)
node scripts/run-cron.mjs payslips 2026-10   # a specific month
npm run cron:jobs
```

- **Vercel:** `vercel.json` schedules all three daily. Set `CRON_SECRET` in the project's environment.
- **Local machine:** add a crontab entry while the app is running, e.g. `30 0 * * * cd /path/to/HRMS-main && npm run cron:payslips`.

## Deployment (Vercel + Neon)

Production runs on Vercel (region `sin1`, Singapore) with a Neon Postgres database in the same region, attached through the Vercel Neon integration (env prefix `DATABASE`, so the app reads `DATABASE_URL`). Every push to `main` deploys production; pull requests get preview deployments.

- **URLs:** no `BETTER_AUTH_URL` is needed on Vercel. `lib/shared/app-url.ts` uses the production domain on production and the deployment URL on previews. Set `BETTER_AUTH_URL` only for a custom domain.
- **Environment:** set the same variables as `.env` in the Vercel project, except the URLs. Use a fresh `BETTER_AUTH_SECRET` and `CRON_SECRET`, and `PG_POOL_MAX=5` for serverless.
- **Schema changes:** run migrations against Neon's direct (unpooled) URL before or after merging:
  ```bash
  DATABASE_URL="<DATABASE_URL_UNPOOLED from Vercel>" npx prisma migrate deploy
  ```
- **Data upkeep:** run the data scripts against the live database with the unpooled URL, for example:
  ```bash
  DATABASE_URL="<DATABASE_URL_UNPOOLED from Vercel>" npm run db:repair
  DATABASE_URL="<DATABASE_URL_UNPOOLED from Vercel>" npm run db:demo-ready -- --keep-today
  ```
  Don't put the production URL in `.env.local`: Next.js reads it ahead of `.env`, so local dev would write to production.
- **Cron:** Vercel calls `/api/cron/*` daily (see `vercel.json`) with `CRON_SECRET`.
- **Rate limits:** without `REDIS_URL` they are per serverless instance. Add an Upstash Redis URL for shared limits.

## Continuous integration

`.github/workflows/ci.yml` runs lint, typecheck, tests, and the production build against a fresh Postgres on every pull request and push to `main`.

## Useful scripts

```bash
npm run dev                # start the app
npm test                   # unit tests
npm run build              # production build
npm run db:migrate         # create a migration from schema changes
npm run db:seed            # reset demo data
npm run db:repair          # fix data drift without reseeding (hours, wages, dates, reviewers)
npm run db:demo-ready      # prepare the demo (add -- --keep-today to keep today's clock-ins)
npm run db:studio          # browse the database
npm run cron:payslips      # trigger the month-end payslip email job locally
```
