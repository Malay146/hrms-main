# HRMS Performance & Optimization Plan

**Date:** 2026-09-05  
**Status:** Plan only (not yet implemented)  
**Audience:** Engineers implementing speedups across admin/employee App Router surfaces  
**Related:** Employees already use server pagination + one `unstable_cache` path; TanStack Query and Zustand are in `package.json` but unused.

---

## 1. Goal

Make the HRMS feel and measure as **fast at 300–1,000+ employees** without rewriting the product.

Concrete outcomes after this plan:

| Metric | Target |
|--------|--------|
| List server actions (attendance, contracts, leave, payslips) p95 | &lt; 150ms at ~1k employees / 30-day attendance window |
| Admin home (dashboard + payroll KPIs) p95 | &lt; 200ms cached, &lt; 500ms cold |
| RSC HTML for typical list page | &lt; ~100KB compressed |
| Client filter → paint (with keepPreviousData) | &lt; 100ms perceived |
| List endpoints | No unbounded `findMany` without `take` |
| Hot SQL | Indexes used (`EXPLAIN`) |

**North star:** never hydrate what you do not paint. Ship a **page of rows**, not the warehouse.

---

## 2. Current-state diagnosis

### 2.1 What already works

- **Employees directory** (`app/admin/people/employees/` + `listEmployees`): URL-driven `page` / filters / sort, server `skip`/`take`, `EmployeeCard` memo, composite indexes migration `20260905220000_employee_list_indexes`, sole `unstable_cache` + `revalidateTag("employees")` for directory stats.
- **Prisma singleton** (`lib/db.ts`) with adapter-pg.
- **Employee-scoped dashboards** generally query by `userId` (narrow).

### 2.2 Structural problems

| Area | Reality |
|------|---------|
| Server pagination | **Only employees.** Attendance, contracts, leave, allocations, payruns, payslips, payroll rows, recruitment board load **full org datasets**. |
| Client pagination | `useClientPagination` (`components/ui/list-pagination.tsx`) slices arrays **after** the full payload arrived — improves scroll UX only. |
| Caching | Almost none beyond employee stats. Most mutations use broad `revalidatePath`. |
| TanStack Query / Zustand | Installed, **zero** `QueryClientProvider` / stores in app. |
| Aggregates | Dashboard / payroll dashboard often `findMany` then filter/count in JS. |
| Payload bloat | `listPayslips` includes **all lines**; `listPayruns` includes payslips only for counts/warnings. |
| N+1 | `computePayrunAction` does per-slip duplicate lookups in a loop. |
| Bundle | Top-level `xlsx` on employees server module; Recharts pulled into multiple admin/employee clients; Dicebear SVG per avatar cell. |

### 2.3 Highest-impact bottlenecks (ranked)

1. **Attendance** — entire history + nested profile/schedule; grows with employees × days.  
2. **Payroll dashboard** — period attendance + leaves + payslips loaded, then JS-filtered.  
3. **Payslips list** — every slip with `lines: true`.  
4. **Payruns list** — all payslips included for `length` / warning counts.  
5. **Admin home** — `getAdminDashboard` + `getPayrollDashboard` in parallel; full profile scan for distribution pie.  
6. **Payrun compute N+1** — duplicate detection per slip.  
7. **Recruitment** — full jobs + candidates into a very large client.  
8. **Contracts** — unbounded list + form options load every employee.  
9. **Leave / allocations** — full-table RSC hydrate.  
10. **Departments** — all members nested under every dept.  
11. **AI analytics snapshot** — org-wide employees + attendance window + all leaves.  
12. **Employee search** — ILIKE without trigram; stats loader still O(n) on cache miss.  
13. **Dead client libs + heavy deps** — unused TanStack/Zustand; live Recharts/xlsx/Dicebear cost.  
14. **Client-only pagination pattern** — masks length, not TTFB/memory.  
15. **Missing indexes** — contracts expire path, payrun periods, payslip status, attendance status, etc.

---

## 3. Principles

1. **Server owns list truth** — `searchParams` for `q`, filters, sort, `page`, `pageSize`. RSC (or TanStack → server action) fetches **one page**.  
2. **Select less** — Prisma `select` only columns the UI paints; never include detail children on list endpoints.  
3. **Aggregate in the database** — `_count`, `groupBy`, SQL sums; not “load rows and reduce in Node.”  
4. **Cache what is shared and slow** — org KPIs, distribution, source pie; tag-invalidate on writes.  
5. **TanStack for interactive refetch** — kanban moves, filter changes without full document navigation; `staleTime` + `placeholderData`.  
6. **Zustand for chrome only** — sidebar, command palette, drag ghost. **Never** mirror the employee table in a store.  
7. **Measure** — p95 action timing, payload size, React Profiler, `EXPLAIN` — before calling it “done.”

---

## 4. Architecture (target)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  • URL searchParams = list state                             │
│  • TanStack Query: keyed lists / board slices                │
│  • Zustand: shell UI only                                    │
│  • memo rows + dynamic() charts                              │
└────────────────────────────┬────────────────────────────────┘
                             │ server actions / RSC
┌────────────────────────────▼────────────────────────────────┐
│  Next.js App Router                                          │
│  • Paginated list actions (skip/take + where + orderBy)      │
│  • unstable_cache / "use cache" for org snapshots            │
│  • revalidateTag on mutations (employees, attendance, …)     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  PostgreSQL + Prisma                                         │
│  • Composite indexes for filters/sort/expire                 │
│  • groupBy / _count / narrow select                          │
│  • Optional pg_trgm for name/email search                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Phase plan

### Phase P0 — Stop shipping the whole table (Week 1) — **Critical**

Promote every heavy list to the **employees pattern**.

| Surface | Today | Target API |
|---------|-------|------------|
| Attendance | All logs + nested schedule | `page`, `pageSize`, **default date window** (e.g. current week/month), `status`, `search` |
| Contracts | All contracts | `page`, `status`, `endingSoon`, `search` |
| Leave / allocations | Full tables | `page`, `status`, employee filter |
| Payslips | All slips **with lines** | List **without** `lines`; lines on detail/print only |
| Payruns | Payslips included for counts | `_count` / aggregates only |
| Recruitment applicants table | Full board | Paginated table; kanban **per-stage `take N`** + “load more” |
| Payroll wage rows | All employees | `page` + department + search |
| Contract / attendance employee pickers | Every employee | Debounced search API, `take: 20` |

**URL contract (align with employees):**

- `q`, `department`, `status`, `from`, `to`, `sort`, `dir`, `page`, `view` as needed  
- Clearing filters resets `page=1`  
- Client pagination helper remains only for **already-paged** UI chrome if needed — not as the primary data boundary

**Acceptance:** DevTools Network shows list RSC/action responses scale with `pageSize`, not with total headcount.

---

### Phase P1 — Indexes, aggregates, caching (Week 1–2) — **Critical**

#### 5.1 Indexes (new migration)

Add indexes matching real `where` / `orderBy` / expire paths:

| Model | Suggested indexes |
|-------|-------------------|
| `Contract` | `(status, endDate)`, optionally `(employeeId, status)` |
| `Payrun` | `(organizationId, periodStart, periodEnd)`, `(status)` |
| `Payslip` | `(status)`, `(createdAt)`, keep/strengthen `payrunId` lookups |
| `Attendance` | composites including `(date, status)` for dashboard counts |
| `JobOpening` | `(organizationId, status)` |
| `TimeOffAllocation` | `(status, validityYear)` |
| `EmployeeProfile` | optional `(joinDate)` for sort; **pg_trgm** on `fullName` / email for ILIKE |
| `WorkingSchedule` / `SalaryStructure` | `(active)` if filtered often |

Validate with `EXPLAIN (ANALYZE, BUFFERS)` on attendance list, contract expire update, payrun period filters.

#### 5.2 Prisma query discipline

- **Payslips list:** strip `lines` include.  
- **Payruns list:** replace payslip array with `_count: { select: { payslips: true } }` and a cheap warning aggregate.  
- **Payroll dashboard:** push present/late/absent/leave counts and salary-by-department into `groupBy` / raw SQL; stop loading full attendance arrays for KPIs.  
- **Admin distribution:** `groupBy` department counts — not `findMany` all profiles.  
- **computePayrun:** one batched query for duplicate detection (or set + single query), never per-slip `findFirst` in a loop.  
- **Departments:** list depts without all members; members via `?departmentId=&page=`.  
- **Pool:** document/tune `pg` pool `max` for local vs deploy.

#### 5.3 Caching layers

| Layer | Cache what | TTL / invalidation |
|-------|------------|--------------------|
| `unstable_cache` / `"use cache"` | Org stats, dept distribution, payroll KPI cards, recruitment source counts, admin-home snapshot | 15–60s; tags: `employees`, `attendance`, `payroll`, `recruitment`, `leave` |
| `revalidateTag` | After mutations | On write — prefer tags over blanket `revalidatePath` of large trees |
| TanStack Query | Client list/board refetch | `staleTime` 20–60s; invalidate on mutation success |
| HTTP / CDN | Landing, icons, fonts (`next/font`) | Long-lived immutable assets |
| **Never cache** | Auth session, payslip PII detail, password/credential flows | — |

**Admin home specifically:** merge overlapping work in `getAdminDashboard` + `getPayrollDashboard` into a single **cached admin-home snapshot** (counts, top-N activities, salary-by-dept from wages/contracts). Invalidate on attendance / leave / payroll tags.

---

### Phase P2 — Client runtime (Week 2–3) — **High**

#### 5.4 TanStack Query

- Mount **one** `QueryClientProvider` in the authenticated shell (admin + employee layouts).  
- Query keys: `["employees", filters]`, `["attendance", range, filters]`, `["contracts", filters]`, `["recruitment", "board"]`, `["recruitment", "applicants", filters]`, etc.  
- Use `placeholderData: keepPreviousData` (or `placeholderData: (prev) => prev`) while paging.  
- Prefetch next page on **Next** hover.  
- Mutations (leave approve/reject, kanban stage move, attendance correct): optimistic update where safe → `invalidateQueries` / server `revalidateTag`.

Server actions remain the data API; TanStack is the **client cache and orchestration**, not a second backend.

#### 5.5 Zustand (narrow)

Allowed stores (examples):

- Sidebar collapsed / mobile drawer  
- Command palette open  
- Recruitment drag overlay / transient UI  

**Forbidden:** storing full employee/attendance/contract arrays.

Use selectors + shallow compare; split slices if the store grows.

#### 5.6 Re-render control

| Technique | Where |
|-----------|--------|
| Split giant clients | `recruitment-client`, dashboard, analytics → header / table / charts islands |
| `memo` row components | Attendance, leave, contract, payslip rows (same idea as `EmployeeCard`) |
| Debounced URL updates | Search boxes → `searchParams`, not `setState(fullArray)` on every key |
| Virtualization | TanStack Virtual if `pageSize` &gt; 50 or kanban columns get very tall |
| `next/dynamic` charts | Recharts with `ssr: false` on dashboard / analytics / recruitment only |
| Avatar cost | Memoize Dicebear by name, or persist `avatarUrl` / use initials |

---

### Phase P3 — Bundle & assets (Week 3–4) — **Medium**

| Dependency | Action |
|------------|--------|
| `xlsx` | Dynamic `import()` **inside** spreadsheet import action only; keep off cold path of `listEmployees` |
| `recharts` | Route-level code split; do not pull chart helpers into shared layout/navbar |
| `motion` | Landing / marketing only |
| `@dicebear` | Reduce per-cell work (memo or static) |
| Dead weight | After TanStack/Zustand are wired for real use-cases, remove any leftover unused client patterns; do not leave “installed but idle” as the steady state |

`next.config.ts`: consider package import optimizations where safe; keep Prisma/pg external as today.

---

## 6. Implementation backlog (ordered)

| # | Work item | Why | Effort |
|---|-----------|-----|--------|
| 1 | Payslips list: drop `lines` include | Huge payload, unused on list UI | S |
| 2 | Payruns list: `_count` instead of include payslips | Stops loading every slip | S |
| 3 | Attendance server pagination + default date window | Largest growing table | M |
| 4 | Contracts + leave + allocations server pagination | Same pattern as employees | M |
| 5 | Indexes migration (contract / payrun / payslip / attendance / …) | Makes #3–4 cheap | S |
| 6 | Admin dashboard aggregated + cached snapshot | Every admin session hit | M |
| 7 | Payroll dashboard: SQL aggregates, not JS filter | Home-page lag | M |
| 8 | Recruitment: stage-capped board + paged applicants | Heavy client | M |
| 9 | `computePayrun` batched duplicate check | N+1 on compute | S |
| 10 | TanStack `QueryClientProvider` + list queries | Fast filter/refetch UX | M |
| 11 | `dynamic()` Recharts + split recruitment client | JS parse / hydrate time | S |
| 12 | Dynamic `xlsx`; avatar memo | Bundle + list paint | S |
| 13 | Departments members paged endpoint | Org scale | S |
| 14 | AI snapshot: prefer pre-aggregated metrics | Analytics cold path | L |
| 15 | Zustand for shell UI only | Intentional client state | S |

**Suggested sequencing:** 1 → 2 → 5 → 3 → 4 → 6 → 7 → 9 → 8 → 10 → 11 → 12 → 13 → 15 → 14.

---

## 7. Per-domain notes

### 7.1 People — Employees

Already the reference implementation. Extend:

- Keep sort/filter server-side (already added).  
- Ensure KPI card filters stay URL-driven (list view).  
- Cache hit rate on stats; avoid reloading all `userId`s on every miss if a cheaper count query exists.

### 7.2 People — Attendance

- Default `from`/`to` to current week (or month); never “all time” on first paint.  
- List select: identity + times + status — not full schedule lines unless editing.  
- Detail route loads schedule context.

### 7.3 People — Contracts / Leave / Allocations

- Mirror employees: server page + status filters.  
- `expirePastContracts` must use indexed `(status, endDate)`.  
- Employee pickers: typeahead API, not full options dump.

### 7.4 HR — Recruitment

- Board: per-stage preview (`take: 5–10`) + “View more” fetching that stage.  
- Applicants table: server pagination + filters (already partially client).  
- Source pie: aggregate query or cached board stats — not “group in client over all candidates” if the list is paged.

### 7.5 HR — Payroll

- Lists: aggregates and counts only.  
- Detail/wizard: full slips and lines.  
- Dashboard salary chart: wage/contract rollup (already preferred over paid-only) — keep that as an **aggregate**, cache it.

### 7.6 Admin dashboard & analytics

- Single cached snapshot for home.  
- Analytics/AI: feed models **aggregates**; consider a materialized “metrics snapshot” table or cached builder shared with analytics (see AI analytics plan) so `/admin/analytics` does not re-scan all leaves every time.

---

## 8. Tagging & invalidation map

Use consistent cache tags:

| Tag | Invalidate when |
|-----|-----------------|
| `employees` | Create/update/deactivate employee, import, department moves affecting roster |
| `attendance` | Upsert attendance, bulk corrections |
| `leave` | Leave decide / apply / allocation changes |
| `contracts` | Contract upsert/delete/expire |
| `payroll` | Payrun compute/validate/pay, payroll row save, payslip email (stats only) |
| `recruitment` | Job create, stage move, reject, interview schedule |

Mutations should call `revalidateTag(...)` for the smallest set that keeps UI correct.

---

## 9. Definition of done (checklist)

### Server

- [ ] No list/board action uses unbounded `findMany` without `take` (except intentionally tiny admin enums: leave types, structures).  
- [ ] Payslip **list** does not include lines.  
- [ ] Payrun **list** does not include full payslip rows.  
- [ ] New indexes applied and verified with `EXPLAIN`.  
- [ ] Admin home and payroll KPIs served from tagged cache or aggregate queries.  
- [ ] Payrun compute has no per-row duplicate query loop.

### Client

- [ ] `QueryClientProvider` live; at least employees + attendance + recruitment applicants use TanStack.  
- [ ] Zustand (if used) has no domain list arrays.  
- [ ] Recharts loaded via `dynamic` on chart routes only.  
- [ ] `xlsx` not on the default employees list module graph.  
- [ ] Large tables use memoized rows; Profiler shows row interaction does not re-render the entire page shell.

### Measurement

- [ ] Record before/after p95 for: attendance list, contracts list, admin home, payslips list.  
- [ ] Record before/after transfer size for those routes.  
- [ ] Document numbers in a short appendix or PR description when implementing.

---

## 10. Out of scope (for this plan)

- Rewriting auth (Better Auth) or payroll compute formulas.  
- Moving off Prisma.  
- Real-time websockets for attendance.  
- Micro-frontends / separate services.  
- Premature Redis unless a single Postgres + Next cache layer proves insufficient at real load.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| URL/API churn breaks bookmarks | Keep param names stable (`q`, `page`, `status`, …); document defaults |
| Stale TanStack vs RSC | Single invalidation story: mutation → tag + `invalidateQueries` |
| Over-caching PII | Never cache payslip detail or credentials; short TTL on org aggregates only |
| Kanban feels empty with `take N` | “View more” / stage-specific fetch (already a UX pattern on recruitment) |
| Index bloat | Add only indexes proven by `EXPLAIN` / slow queries |

---

## 12. References (codebase)

| Path | Role |
|------|------|
| `lib/actions/people/employees.ts` | Reference paginated list + cache tag |
| `lib/actions/people/attendance.ts` | Unbounded logs (P0 target) |
| `lib/actions/people/contracts.ts` | Unbounded contracts + options |
| `lib/actions/payroll/payruns.ts` | Payslip lines / payrun includes / compute N+1 |
| `lib/actions/payroll/payroll-dashboard.ts` | Period scans + JS filters |
| `lib/actions/dashboard.ts` | Admin distribution / activities |
| `lib/actions/recruitment.ts` | Full board load |
| `lib/db.ts` | Prisma + pg adapter |
| `components/ui/list-pagination.tsx` | Client-only pagination (insufficient alone) |
| `prisma/schema.prisma` | Index inventory |
| `prisma/migrations/20260905220000_employee_list_indexes/` | Existing list indexes |
| `package.json` | `@tanstack/react-query`, `zustand`, `recharts`, `xlsx` |

---

## 13. Summary

This codebase is already **feature-rich** and partially optimized on the employees directory. The remaining gap is systemic: **most lists still serialize the entire table**, dashboards **recompute from raw rows**, and **installed client data libraries are idle** while heavy chart/spreadsheet code stays on critical paths.

Implementing this plan in order — **slim queries → indexes → server pagination → tagged cache → TanStack → bundle splits** — should yield large, measurable gains in TTFB, payload size, and interaction smoothness without a rewrite.

When ready to execute, start with backlog items **1–5** (payslips/payruns shape, indexes, attendance + contracts pagination); those alone unblock most admin “feels slow” reports.
