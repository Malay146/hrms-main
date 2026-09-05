# PeoplePay360 — AI Features Design

**Date:** 2026-09-05  
**Status:** Design (not yet implemented)  
**Companion plan:** [`2026-09-05-ai-analytics-implementation.md`](./2026-09-05-ai-analytics-implementation.md)  
**Brand:** `DESIGN.md`  
**Product rules:** existing People / Payroll tracks; this is a **new AI track** and must not rewrite Malay’s People trees or Krishil’s payroll engine.

---

## 1. Why AI belongs here

PeoplePay360 already stores the data an HR copilot needs: employees, departments, attendance, leave, and (once payroll lands) payslips. The admin sidebar already has **AI Analytics** at `/admin/analytics`, and that page’s copy promises workforce insights, attrition prediction, and hiring intelligence. Those screens are still “Coming Soon.”

The goal is not a chatbot bolted onto the sidebar. The goal is:

1. **AI metrics** — numbers HR can trust (computed in TypeScript, tested, no LLM).
2. **AI analysis** — short explanations of *why* those numbers moved, plus what to do next (LLM over aggregates).
3. **AI actions** — assist existing workflows (leave approval, payroll warnings, employee self-service) without inventing new HR modules.

Recruitment and Performance stay mock / Coming Soon. Do not build those domains just to hang AI on them.

---

## 2. What already exists (do not rebuild)

| Surface | Today | AI role |
| --- | --- | --- |
| `/admin` dashboard | Live KPIs: headcount, present, leave today, pending leave, weekly attendance, department pie | Add a one-line “today’s insight” later; keep charts zinc grayscale |
| `/admin/analytics` | Empty “Coming Soon” | **Primary home** for AI metrics + analysis |
| `/admin/people/*` | Employees, departments, attendance, leave | Source data + later “Ask AI” / risk badges |
| `/admin/hr/payroll` | Live / in progress (Krishil) | Payroll cost + anomaly features consume payslips; do not edit `lib/payroll/compute.ts` |
| `/admin/hr/recruitment` | Mock kanban | P2 hiring intelligence only after real jobs/candidates exist |
| `/admin/hr/performance` | Coming Soon | P2 review drafting only after reviews exist |
| `/employee/*` | Dashboard, attendance, leave, payroll, profile | Optional personal insights; never org-wide AI |

Permissions today: any staff role can open `/admin/analytics`. That is too open once the page shows wages, attrition names, and copilot answers. Introduce `viewAiAnalytics` (admin + hr_manager) and `useHrCopilot` (same). Payroll roles keep payroll numbers via existing `viewPayrollAll`; they do not see named flight-risk lists unless they also have people permission.

---

## 3. Architecture (recommended)

**Hybrid: deterministic metrics + LLM narrative.**

```
Postgres (employees, attendance, leave, payslips)
        │
        ▼
lib/ai/metrics.ts          ← pure functions, unit-tested, no API keys
        │
        ▼
lib/actions/ai.ts          ← load org-scoped rows, call metrics, maybe LLM
        │
        ├── GET  /admin/analytics     (KPIs, charts, insight cards)
        ├── POST generateInsights     (LLM over JSON metrics only)
        └── POST askCopilot           (question + tool results, no raw bank/wage dump)
```

| Layer | Job | LLM? |
| --- | --- | --- |
| Metrics engine | Attendance rate, leave load, late rate, payroll outliers, flight-risk score | No |
| Insight writer | 3–6 cards: title, severity, evidence, recommended action | Yes |
| Copilot | Answer a staff question using the same metric JSON + a few named lookups | Yes |
| Assistants | Leave overlap brief, payslip warning rewrite | Yes, optional |

**Why this over “send the whole database to GPT”:** numbers stay auditable, tests stay cheap, PII stays out of prompts, and the UI still works if `OPENAI_API_KEY` is missing (metrics + “AI narrative unavailable”).

**Provider:** Vercel AI SDK (`ai` + `@ai-sdk/openai`) with `OPENAI_API_KEY`. Keep `lib/ai/client.ts` as the only place that talks to a model so the provider can change later. Default model: a small/cheap chat model (e.g. `gpt-4o-mini`). No embeddings, no vector DB, no fine-tuning in v1.

**Prompt contract:** send **aggregates and scores**, never bank accounts, passwords, or full wage tables. Employee names only when the caller has `managePeople` and the feature is explicitly a named list (flight risk, leave clash). Log `kind`, token counts, and a hash of the prompt — not the prompt body if it contains names.

---

## 4. Feature catalog

Priority: **P0** ships the empty Analytics page into a real product. **P1** is analysis people will demo. **P2** waits on other modules or more data.

### P0 — AI Metrics (no LLM required)

These are the “AI metrics” the product can show on day one. They are statistical, not generative.

#### F1. Workforce health score (0–100)

Composite of last-30-day attendance rate, pending-leave backlog vs headcount, inactive share, and (if payslips exist) payrun completeness. Show as a KPI on `/admin/analytics` with a one-word band: Healthy / Watch / At risk. Color only on the badge (`success` / `warning` / `destructive`), not on the card chrome.

**Inputs:** `Attendance`, `LeaveRequest`, `EmployeeProfile.status`, optional `Payrun`.  
**Output:** `{ score, band, parts[] }`.

#### F2. Attendance intelligence

- Org and per-department attendance % (present + half_day vs expected working days).
- Late rate (reuse existing late check-in helper).
- Missing checkout count.
- Trend vs previous 30 days.

Charts stay zinc gradients (`#E4E4E7` → `#18181B`), same as the admin dashboard.

#### F3. Leave load metrics

- Pending count and average wait hours.
- Approved days by type (paid / sick / unpaid) for the selected period.
- Team clash: same department, overlapping approved or pending ranges.
- Balance pressure: employees with paid leave balance below a threshold (e.g. ≤ 3 days) vs those who never take leave (possible burnout proxy).

#### F4. Payroll cost metrics (permission-gated)

Only if `viewPayrollAll`. Do not invent statutory law tables.

- Total net / gross for latest paid payrun (or legacy `Payroll` rows until cutover).
- Cost by department.
- Payslips with warnings (missing bank, no contract) — consume Krishil’s warning strings, do not reimplement the engine.
- Simple outlier flag: net more than N standard deviations from the structure mean (deterministic).

### P1 — AI Analysis (LLM over F1–F4)

#### F5. Insight cards (“what should I look at?”)

On **Refresh insights**, send the metric JSON to the model and store 3–6 cards:

```ts
{
  id: string
  severity: "info" | "watch" | "alert"
  title: string          // ≤ 80 chars
  body: string           // 2–4 sentences, cite the numbers
  action: string         // e.g. "Review Engineering leave clash next week"
  href?: string          // deep link to /admin/people/leave etc.
  metricKey?: string
}
```

Show cards in a list under the KPI strip. Badge color by severity. Copy must stay operational, not marketing.

**Empty / failure:** if the key is missing, show metrics anyway and a neutral banner: “Connect an AI provider to generate written analysis.”

#### F6. Flight-risk list (attrition proxy)

The Coming Soon blurb already promises attrition prediction. With no resignation history, do **not** fake a neural net. Score each active employee 0–100 from:

| Signal | Why it is allowed |
| --- | --- |
| Attendance drop vs their own 60-day baseline | Present in `Attendance` |
| Rising sick / unpaid leave | Present in `LeaveRequest` |
| Tenure proxy (`EmployeeProfile.createdAt`) in first 90 days or after 18 months | Weak but honest |
| Unused paid leave + falling attendance | Burnout proxy |
| Missing bank / inactive contract (when Malay’s contracts exist) | Operational, not psychological |

LLM writes a **short reason** from the score breakdown. UI: table on Analytics, names only for `managePeople`. Label it **Flight-risk indicators**, not “will resign.”

#### F7. HR Copilot (ask the org)

A single input on `/admin/analytics`: “Ask about this period.”

Allowed questions (tool-calling / JSON answers, not free SQL):

- Who is absent or not checked in today?
- Which department has the worst attendance this month?
- How many leave days are pending? Who is waiting longest?
- Are there overlapping leaves on a team next week?
- What is total net in the last paid payrun? (payroll permission)
- Summarize workforce health.

Refuse: salary of a named person unless payroll permission **and** a dedicated tool; anything outside HR data; “write a PIP” until Performance exists.

Stream the answer into a zinc panel. Cite which metric or count was used.

#### F8. Leave approval brief

On `/admin/people/leave`, for a pending row: **Summarize for approver**.

Uses remarks + overlapping team leave + remaining paid balance. Output: 3 bullets + recommend Approve / Review / Reject **as a suggestion only**. The existing approve/reject actions stay the source of truth. Malay owns the leave page — add a small client island, do not rewrite the leave table.

### P2 — Later (valuable, blocked or easy to overbuild)

| ID | Feature | Blocker / reason to wait |
| --- | --- | --- |
| F9 | Employee personal insights | Privacy: only the signed-in employee’s attendance/leave; no org ranking |
| F10 | Payslip “explain this line” | After Krishil Phase 4 payslip detail exists |
| F11 | Draft reminder emails (missing checkout, pending leave) | Needs live notifications; SMTP already exists |
| F12 | Policy Q&A over handbook PDFs | Needs document store + embeddings; skip until HR uploads files |
| F13 | Recruitment screening / JD match | Recruitment is mock |
| F14 | Performance review drafts / goal suggestions | Performance is Coming Soon |
| F15 | Shift / roster suggestions | Depends on Malay working schedules being real |
| F16 | Sentiment on leave remarks | Tiny corpus; high false-positive risk; skip |

---

## 5. Screens and UX

Follow `DESIGN.md`. App page shell:

`w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6`

**`/admin/analytics` (staff with `viewAiAnalytics`)**

1. H1 `text-h1 font-medium` — AI Analytics. Subtitle `text-body-lg text-zinc-500 font-medium`.
2. Period control (last 30 days / this month / custom) — same density as other admin filters.
3. KPI row (4–5 cards): Health score, Attendance %, Leave days, Pending approvals, Payroll net (or em dash + “No payroll access”).
4. Two charts: attendance trend (bar), leave by type or department (pie) — grayscale only.
5. Insight cards (F5).
6. Flight-risk table (F6), hidden without `managePeople`.
7. Copilot composer (F7).
8. Primary button **Refresh insights**: `rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98`.

**Do not:** blue CTAs, rainbow series, centered titles, new fonts, Lucide replacing the sidebar AI icon.

Employee portal: no Analytics nav item. F9 would live on `/employee` as a quiet card, not a second AI product.

---

## 6. Data, schema, privacy

**v1 can ship without new tables** by computing metrics per request. Add persistence when LLM calls are worth caching:

```text
AiInsight     organizationId, kind, severity, title, body, action, href, payload Json, generatedAt, expiresAt
AiAskLog      userId, question, answer, createdAt   (optional; omit question text if it contains names)
```

Organization scoping: every query filters by the current user’s `EmployeeProfile.organizationId`. Never mix orgs.

**Hard rules**

- Bank account, SMTP, passwords, `BETTER_AUTH_SECRET` never leave the server.
- Wage / net sent to the model only as department totals or anonymized outlier counts, except F10 (employee viewing their own payslip).
- Copilot tools return counts and display names the user could already see in the UI.
- Insights expire (e.g. 6 hours) so stale “Engineering is understaffed” does not linger after approvals.

---

## 7. What we are not building

- A second dashboard that duplicates `/admin` KPIs without analysis.
- Client-side `eval` or sending formula strings to an LLM to compute salary (Krishil’s engine is the source of truth).
- Training custom models or storing embeddings in Postgres for v1.
- Psychological profiling, union-busting, or “productivity scores” from keystrokes (we have no such data).
- Replacing Performance / Recruitment with AI-generated fake data.

---

## 8. Success criteria

A reviewer can log in as `admin@oddo.com`, open **AI Analytics**, and:

1. See live health / attendance / leave numbers that match People data (no LLM).
2. Click **Refresh insights** and get 3+ cards that mention real departments or counts from seed data.
3. Ask “Who is on leave today?” and get names that match `/admin/people/leave`.
4. Log in as a payroll-only role and **not** see named flight-risk rows.
5. Log in as an employee and **not** open `/admin/analytics`.
6. With `OPENAI_API_KEY` unset, metrics still render; narrative and copilot show a calm empty state.

---

## 9. Suggested build order

| Phase | Features | Depends on |
| --- | --- | --- |
| 1 | F1–F3 metrics engine + Analytics UI | Current schema |
| 2 | F4 payroll metrics | Payslips or legacy `Payroll` |
| 3 | F5 insight writer + cache | API key |
| 4 | F6 flight-risk + F7 copilot | Phase 1 |
| 5 | F8 leave brief | Coordinate with Malay’s leave client |
| 6 | F9–F11 | Employee UX / mail / payslip detail |
| — | F12–F16 | Other modules |

Implementation tasks, files, tests, and commits: [`2026-09-05-ai-analytics-implementation.md`](./2026-09-05-ai-analytics-implementation.md).
