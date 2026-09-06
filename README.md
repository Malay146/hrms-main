# HRMS (PeoplePay360)

Next.js HRMS with PostgreSQL + Prisma 7 + Better Auth.

**Evaluator / jury notes:** [docs/EVALUATOR-HANDBOOK.md](docs/EVALUATOR-HANDBOOK.md) — features, edge cases, performance work, stack, and what is still stubbed.

## Prerequisites

- Node 20+
- PostgreSQL 16+ (Homebrew recommended — **not Docker**)

## Setup (local Postgres)

```bash
# Install + start Postgres on port 5433
brew install postgresql@16
# In postgresql.conf set: port = 5433
brew services start postgresql@16
# Or: pg_ctl -D /opt/homebrew/var/postgresql@16 -l /tmp/pg16.log start

# Create role + database (once)
psql -h 127.0.0.1 -p 5433 -d postgres -c "CREATE ROLE postgres LOGIN PASSWORD 'admin123' SUPERUSER;"
psql -h 127.0.0.1 -p 5433 -d postgres -c 'CREATE DATABASE "PeoplePay360" OWNER postgres;'

# App env
cp .env.example .env
# DATABASE_URL=postgresql://postgres:admin123@localhost:5433/PeoplePay360

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Seed logins

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@oddo.com` | `admin@oddo@1234` |
| Demo employees | e.g. `william.joseph@oddo.com` | `Employee@1234` |

Public sign-up is closed. Admins create users from **Employees → Add User**.

## Wired to Postgres

Auth, employees, departments, attendance, leave, payroll, dashboards, profile, password change, AI Analytics metrics.

## AI Analytics

Admin and HR Manager can open **AI Analytics** (`/admin/analytics`). Live health, attendance, leave, and payroll metrics work without a model. Written insight cards need `OPENAI_API_KEY` in `.env`. The copilot still answers attendance/leave count questions from the database when no key is set.

Payroll-only roles and employees cannot open `/admin/analytics`.

## Still UI-only / Coming Soon

Recruitment, Notifications, Performance, Admin Settings chrome.

## Useful scripts

```bash
npm run db:migrate
npm run db:seed
npm run db:studio
```
