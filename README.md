# HRMS (PeoplePay360)

Human resource and payroll management for one or more companies: employees, departments, attendance, leave, payroll, performance, recruitment, notifications, and an AI analytics copilot.

Built with Next.js 16, PostgreSQL, Prisma 7, and Better Auth.

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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The seed builds attendance and leave relative to **today**, so dashboards always have live data. Re-run `npm run db:seed` to reset the demo (it wipes the database).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | `postgresql://postgres:PASSWORD@localhost:5432/PeoplePay360` |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3000` locally |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | for email | Gmail SMTP. `SMTP_PASS` must be a [Google App Password](https://myaccount.google.com/apppasswords) (2-Step Verification on) |
| `MAIL_SKIP_DOMAINS` | no | Recipient domains that never get mail. Default `company.com` (the seeded demo accounts) |
| `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | no | Any OpenAI-compatible provider. Free option: Google Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/`, `gemini-3.5-flash-lite`, key from [AI Studio](https://aistudio.google.com/apikey)). Gemini's free tier may use prompts to improve Google products |
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

New companies register at `/sign-up`; the founder becomes that company's admin. Inside a company, admins add people from **Employees → Add User**.

Demo accounts use `@company.com`, which is a real third-party domain, so the app never emails them (see `MAIL_SKIP_DOMAINS`). When an email is skipped, the new user's temporary password is shown on screen instead.

## Features

All of these read and write PostgreSQL:

- **People:** employees, departments, working schedules, contracts, Excel import
- **Attendance:** clock in/out, manual corrections, daily rollups
- **Leave:** time-off types, allocations, requests, approvals, balances
- **Payroll:** salary structures and rules, payruns (compute, validate, mark paid), payslips with print view and email
- **Performance:** review cycles, goals, self and manager reviews
- **Recruitment:** job openings and a candidate pipeline (stage moves, interviews, reject). Adding applicants by hand is not built yet
- **Notifications:** in-app plus optional email, per-user preferences, announcements
- **AI Analytics** (admin and HR manager): live health metrics, AI insight cards, and an HR copilot that answers from the database and can take actions
- **Settings:** organization name and email (admin only), password change, and signed-in sessions with remote sign-out
- **REST API:** `/api/v1/*` with Swagger UI at `/swagger-ui`. It uses the same session cookie and permissions as the app

## Scheduled jobs

`/api/cron/payslips` emails validated payslips for the closing month (once per payslip, so daily runs are safe). `/api/cron/jobs` drains queued background jobs. Both need `Authorization: Bearer $CRON_SECRET`.

```bash
npm run cron:payslips          # this month (or the last one, before month end)
node scripts/run-cron.mjs payslips 2026-10   # a specific month
npm run cron:jobs
```

- **Vercel:** `vercel.json` schedules both daily. Set `CRON_SECRET` in the project's environment.
- **Local machine:** add a crontab entry while the app is running, e.g. `30 0 * * * cd /path/to/HRMS-main && npm run cron:payslips`.

## Useful scripts

```bash
npm run dev                # start the app
npm test                   # unit tests
npm run build              # production build
npm run db:migrate         # create a migration from schema changes
npm run db:seed            # reset demo data
npm run db:repair          # fix demo data drift without reseeding
npm run db:studio          # browse the database
```
