# Fault Tolerance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make PeoplePay360 recover from process crashes, database slowness, client disconnects, and third-party outages without double-sending payroll mail or leaking internal errors to the browser.

**Architecture:** Keep a single Next.js process + one Postgres (Better Auth sessions live in the same database). Add fail-fast timeouts, branded error shells, idempotent jobs, and bounded retries around SMTP/OpenAI. Do not invent a second session store, Redis, or multi-region active-active in this pass — those are platform projects, not this zinc UI.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + `@prisma/adapter-pg` + `pg` Pool, Better Auth cookie cache (5 min), existing `{ ok, error }` `ActionResult`, node:test, DESIGN.md page shells.

---

## Honest limit

No website is resistant to every failure. A tab crash before the request leaves the browser, a deleted `DATABASE_URL`, or a total Postgres outage cannot be papered over in React. This plan is **graceful degradation**: fail fast, recover in the UI, retry only idempotent work, and keep HR writes independent of mail and OpenAI.

Visual scenario matrix: Cursor canvas `hrms-fault-tolerance.canvas.tsx`.

## Current posture (repo, 2026-09-05)

| Area | Reality |
| --- | --- |
| Render crash | No `app/error.tsx`, `app/global-error.tsx`, or `app/not-found.tsx` |
| Postgres | `lib/db.ts` sets `connectionTimeoutMillis: 5_000` only. No pool `max`, no `statement_timeout`, no Prisma transaction timeout |
| Auth gate | `proxy.ts` calls `auth.api.getSession` on every page. `/api/**` is excluded. Cookie cache is 5 minutes — it does **not** keep the app up if Postgres is down for a new session lookup |
| Health | `GET /api/v1/health` is public liveness (`service` + `version`). It does **not** ping Postgres |
| Actions | `{ ok, error }` envelopes. `actionErrorMessage` returns `error.message` for any `Error`, including Prisma/pg internals |
| Client | Login/forms disable while pending. No offline banner. Copilot optimistic messages are React state only. `@tanstack/react-query` is mounted in `AppChrome` with **zero** `useQuery` |
| Jobs | `deliverUnsentPayslip` skips if `sentAt` is set, but overlapping cron runs can both send before either writes `sentAt`. Cron also accepts `?secret=` |
| Mail / AI | Employee create does not roll back if SMTP fails (good). OpenAI/SMTP have no abort timeout, retry, or circuit |
| API | `X-Request-Id` on v1. No rate limit. No request id on server actions/logs |

**Already strong:** attendance `@@unique([userId, date])`, payslip `@@unique([payrunId, employeeId])`, ActionResult envelopes, request IDs on v1, AI heuristic fallback when OpenAI is missing.

**Out of scope (do not build):** multi-region active-active, a second Redis session store, “full HR while Postgres is gone”, rewriting the app to React Query, Kubernetes operators.

---

### Task 1: Classify errors — never leak Prisma/pg to the browser

**Files:**
- Create: `lib/shared/errors.ts`
- Create: `lib/shared/errors.test.ts`
- Modify: `lib/auth/session.ts` (`actionErrorMessage`)
- Modify: `package.json` (`test` script — add the new test file)

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicActionError } from "./errors";

describe("publicActionError", () => {
  it("maps unique violations to a conflict message", () => {
    const err = Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), {
      code: "P2002",
    });
    assert.equal(publicActionError(err, "Could not save."), "That record already exists.");
  });

  it("maps timeouts and connection failures to a retry message", () => {
    const timeout = Object.assign(new Error("Timed out fetching a new connection from the connection pool."), {
      code: "P2024",
    });
    assert.match(publicActionError(timeout, "Could not save."), /temporarily unavailable/i);

    const down = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    assert.match(publicActionError(down, "Could not save."), /temporarily unavailable/i);
  });

  it("does not return raw Prisma or pg messages", () => {
    const err = new Error('Invalid `prisma.user.findUnique()` invocation');
    assert.equal(publicActionError(err, "Could not save."), "Could not save.");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/shared/errors.test.ts`

Expected: FAIL — `Cannot find module './errors'` or `publicActionError is not a function`.

**Step 3: Write minimal implementation**

`lib/shared/errors.ts`:

```ts
const RETRY = "The service is temporarily unavailable. Please retry in a moment.";
const CONFLICT = "That record already exists.";

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function isRetryableInfrastructureError(error: unknown): boolean {
  const code = codeOf(error);
  if (code === "P2024" || code === "P2028" || code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ECONNRESET") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /timeout|ECONNREFUSED|connection pool|Can't reach database/i.test(message);
}

export function publicActionError(error: unknown, fallback: string): string {
  const code = codeOf(error);
  if (code === "P2002") return CONFLICT;
  if (isRetryableInfrastructureError(error)) return RETRY;
  return fallback;
}
```

In `lib/auth/session.ts`, keep AuthError / ForbiddenError branches, then call `publicActionError` instead of returning `error.message`:

```ts
export function actionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AuthError) return "Your session expired. Please sign in again.";
  if (error instanceof ForbiddenError) return error.message;
  return publicActionError(error, fallback);
}
```

Add `lib/shared/errors.test.ts` to the `test` script in `package.json`.

**Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/shared/errors.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/shared/errors.ts lib/shared/errors.test.ts lib/auth/session.ts package.json
git commit -m "fix: stop leaking Prisma and connection errors to the browser"
```

---

### Task 2: Structured logs always carry a request id

**Files:**
- Modify: `lib/shared/logger.ts`
- Create: `lib/shared/request-context.ts`
- Create: `lib/shared/logger.test.ts`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runWithRequestId, getRequestId } from "./request-context";

describe("request context", () => {
  it("returns undefined outside a store", () => {
    assert.equal(getRequestId(), undefined);
  });

  it("exposes the id inside runWithRequestId", async () => {
    await runWithRequestId("req_test", async () => {
      assert.equal(getRequestId(), "req_test");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/shared/logger.test.ts`

Expected: FAIL — module missing.

**Step 3: Write minimal implementation**

`lib/shared/request-context.ts` using `AsyncLocalStorage`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const storage = new AsyncLocalStorage<{ requestId: string }>();

export function getRequestId() {
  return storage.getStore()?.requestId;
}

export function newRequestId() {
  return randomUUID();
}

export function runWithRequestId<T>(requestId: string, fn: () => T | Promise<T>) {
  return storage.run({ requestId }, fn);
}
```

In `lib/shared/logger.ts`, merge `requestId: getRequestId()` into every payload when present.

In `lib/api/v1/dispatch.ts`, wrap the handler:

```ts
return runWithRequestId(requestId, () => dispatchInner(...));
```

(Keep `X-Request-Id` as today.)

**Step 4: Run tests**

Run: `npx tsx --test lib/shared/logger.test.ts`

Expected: PASS. Existing `lib/api/v1/openapi.test.ts` still PASS.

**Step 5: Commit**

```bash
git add lib/shared/request-context.ts lib/shared/logger.ts lib/shared/logger.test.ts lib/api/v1/dispatch.ts package.json
git commit -m "feat: attach request ids to API logs"
```

---

### Task 3: Branded recover / not-found shells

**Files:**
- Create: `components/system/recover-panel.tsx` (`"use client"` for the retry button)
- Create: `app/error.tsx`
- Create: `app/not-found.tsx`
- Create: `app/global-error.tsx`
- Create: `app/admin/error.tsx` (same recover panel, keeps AppChrome if the layout survived)
- Create: `app/employee/error.tsx`

Read Next App Router error-file rules under `node_modules/next/dist/docs/` before writing. `global-error.tsx` **must** render its own `<html>` and `<body>` because the root layout may have failed.

**Step 1: No unit test** — this is UI. Verify by throwing in a page later (Task 3 verification).

**Step 2: Recover panel (DESIGN.md)**

Must use page shell + zinc primary, **not** blue:

```tsx
<div className="w-full min-h-full border border-border rounded-2xl p-6 bg-surface flex flex-col gap-6">
  <div>
    <h1 className="text-h1 font-medium">Something went wrong</h1>
    <p className="text-body-lg text-zinc-500 font-medium">
      The page could not finish loading. Your last saved data is still in the system.
    </p>
  </div>
  <div className="flex gap-3">
    <button
      type="button"
      onClick={() => reset()}
      className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sm font-semibold text-white shadow-2xs active:scale-98 px-4 py-2"
    >
      Try again
    </button>
    <a
      href="/"
      className="rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm font-semibold px-4 py-2"
    >
      Home
    </a>
  </div>
</div>
```

`app/error.tsx`:

```tsx
"use client";

import { RecoverPanel } from "@/components/system/recover-panel";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RecoverPanel reset={reset} />;
}
```

`app/not-found.tsx`: same shell, H1 “Page not found”, primary link Home, no Try again.

`app/global-error.tsx`: wrap in `<html lang="en"><body className="bg-background">` and the same panel. Do not import `app/globals.css` if that import is what crashed — duplicate the two background/text classes inline only if needed; prefer importing `./globals.css` first and fall back if QA shows a blank page.

Do **not** dump `error.stack` or Prisma messages into the panel. Optional: `console.error` the digest.

**Step 3: Verify**

Temporarily add `throw new Error("fault-tolerance-probe")` at the top of `app/admin/page.tsx`, load `/admin` signed in, confirm the recover shell (not the default Next overlay in production build). Remove the throw before committing.

Also hit a bogus path like `/admin/this-does-not-exist` and confirm not-found copy.

**Step 4: Commit**

```bash
git add components/system/recover-panel.tsx app/error.tsx app/not-found.tsx app/global-error.tsx app/admin/error.tsx app/employee/error.tsx
git commit -m "feat: add zinc recover and not-found shells for route crashes"
```

---

### Task 4: Liveness vs readiness

**Files:**
- Create: `lib/shared/health.ts`
- Create: `lib/shared/health.test.ts`
- Modify: `lib/api/v1/operations.ts` (existing `getHealth`; add `getReady`)
- Modify: `lib/api/v1/openapi.test.ts`

**Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { livenessPayload } from "./health";

describe("livenessPayload", () => {
  it("does not require a database", () => {
    const body = livenessPayload();
    assert.equal(body.service, "hrms-api");
    assert.equal(body.status, "ok");
  });
});
```

Add an OpenAPI assertion: `spec.paths["/api/v1/ready"]?.get` exists and is public.

**Step 2: Run tests to verify they fail**

Run: `npx tsx --test lib/shared/health.test.ts lib/api/v1/openapi.test.ts`

Expected: health test FAIL (module missing); openapi FAIL on `/ready`.

**Step 3: Implementation**

`livenessPayload()` returns `{ service: "hrms-api", version: "1.0.0", status: "ok" }` — keep `getHealth` using this (no Prisma).

`getReady` handler:

```ts
handler: async () => {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true as const, data: { status: "ready", dbMs: Date.now() - started } };
  } catch {
    return { ok: false as const, error: "Database is not reachable." };
  }
},
```

Mark `getReady` `public: true` like health so a load balancer can call it without a session. `errorToResponse` / `actionToResponse` already map `ok: false` — ensure dispatch returns **503** when the error is the ready probe. Add a branch in `lib/api/v1/http.ts` `statusForActionError`:

```ts
if (/not reachable/i.test(error)) return 503;
```

Do not make `/health` wait on Postgres. Orchestrators should use `/health` for “process up” and `/ready` for “take traffic”.

**Step 4: Run tests**

Run: `npx tsx --test lib/shared/health.test.ts lib/api/v1/openapi.test.ts`

Expected: PASS.

Manual: `curl -i http://localhost:3000/api/v1/health` → 200. With Postgres up, `/api/v1/ready` → 200. (Do not stop the user’s database to test 503 unless they agree.)

**Step 5: Commit**

```bash
git add lib/shared/health.ts lib/shared/health.test.ts lib/api/v1/operations.ts lib/api/v1/http.ts lib/api/v1/openapi.test.ts package.json
git commit -m "feat: split API liveness from Postgres readiness"
```

---

### Task 5: Database pool and statement timeouts

**Files:**
- Modify: `lib/db.ts`
- Bump `PRISMA_GENERATION` (any string change is enough so the singleton rebuilds)

**Step 1: No isolated unit test** (Pool is I/O). After implementation, `npx tsx --test` full suite must still pass.

**Step 2: Implementation**

Replace the adapter constructor with an explicit `pg` Pool:

```ts
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 8_000),
    query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS ?? 8_000),
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    transactionOptions: {
      maxWait: 3_000,
      timeout: 10_000,
    },
  });
}
```

Confirm `pg` Pool option names against the installed `pg` types in `node_modules/@types/pg` or `pg` docs. If `query_timeout` is not in this version, omit it and rely on `statement_timeout`.

Bump `PRISMA_GENERATION` to `"fault-tolerance-v1"`.

**Step 3: Verify**

Run: `npm test`

Expected: PASS. Dev server still serves `/admin` against the existing database.

**Step 4: Commit**

```bash
git add lib/db.ts
git commit -m "fix: cap Postgres pool size and query time so hung SQL cannot pin the process"
```

---

### Task 6: Proxy must not hang the whole site when Postgres is gone

**Files:**
- Modify: `proxy.ts`

**Step 1:** `getSession` currently has no try/catch. If the DB is down, every matched page waits on connect timeout.

**Step 2: Implementation**

```ts
let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
try {
  session = await auth.api.getSession({ headers: request.headers });
} catch (error) {
  logger.error("proxy.session_unavailable", { path: pathname, error: String(error) });
  if (pathname.startsWith("/api")) return NextResponse.next();
  const sorry = NextResponse.rewrite(new URL("/login", request.url));
  sorry.headers.set("x-hrms-degraded", "session-store");
  return sorry;
}
```

Do **not** rewrite `/api/*` (matcher already excludes them). Prefer rewrite to `/login` over a new route unless login itself also calls the DB (it will). Better: add a static `app/unavailable/page.tsx` that does **not** call `requireUser` / Prisma — only the recover panel copy “HRMS is temporarily unavailable. Sign-in will work again when the database is back.” Matcher must include `/unavailable` as public in `isPublic`.

Add `"/unavailable"` to `PUBLIC_PATHS`. Rewrite degraded session lookups there instead of `/login`.

**Step 3: Verify**

Code-review: `PUBLIC_PATHS` includes `/unavailable`. `app/unavailable/page.tsx` has no Prisma import. `npm test` PASS.

**Step 4: Commit**

```bash
git add proxy.ts app/unavailable/page.tsx
git commit -m "fix: fail closed to a static unavailable page when the session store is down"
```

---

### Task 7: Timeouts, retries, and a circuit around SMTP and OpenAI

**Files:**
- Create: `lib/shared/resilience.ts`
- Create: `lib/shared/resilience.test.ts`
- Modify: `lib/shared/mail.ts` (`sendMail`)
- Modify: `lib/ai/client.ts` (`generateText` calls)

**Step 1: Write the failing tests** (pure functions — fake clock, fake `fn`)

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CircuitBreaker, withRetry, withTimeout } from "./resilience";

describe("withTimeout", () => {
  it("aborts a hanging promise", async () => {
    await assert.rejects(
      () => withTimeout(new Promise(() => {}), 10, "smtp"),
      /timed out/i,
    );
  });
});

describe("withRetry", () => {
  it("retries retryable failures then succeeds", async () => {
    let n = 0;
    const result = await withRetry(
      async () => {
        n += 1;
        if (n < 3) throw Object.assign(new Error("fail"), { code: "ETIMEDOUT" });
        return "ok";
      },
      { retries: 3, delayMs: 1 },
    );
    assert.equal(result, "ok");
    assert.equal(n, 3);
  });

  it("does not retry auth failures", async () => {
    let n = 0;
    await assert.rejects(
      () =>
        withRetry(
          async () => {
            n += 1;
            throw Object.assign(new Error("bad"), { code: "EAUTH" });
          },
          { retries: 3, delayMs: 1 },
        ),
      /bad/,
    );
    assert.equal(n, 1);
  });
});

describe("CircuitBreaker", () => {
  it("opens after consecutive failures and fails fast", async () => {
    const breaker = new CircuitBreaker({ name: "smtp", failureThreshold: 2, resetMs: 60_000 });
    await assert.rejects(() => breaker.run(async () => { throw new Error("down"); }));
    await assert.rejects(() => breaker.run(async () => { throw new Error("down"); }));
    await assert.rejects(() => breaker.run(async () => "should not run"), /temporarily unavailable/i);
  });
});
```

**Step 2: Run to verify fail**

Run: `npx tsx --test lib/shared/resilience.test.ts`

Expected: FAIL.

**Step 3: Implementation**

- `withTimeout(promise, ms, label)` — `Promise.race` against `setTimeout`. Clear the timer in `finally`.
- `withRetry(fn, { retries, delayMs })` — retry only when `isRetryableInfrastructureError` or nodemailer `ETIMEDOUT` / `ECONNECTION`. Never retry `EAUTH` / 535.
- `CircuitBreaker` — in-memory per process. `failureThreshold: 5`, `resetMs: 30_000`. While open, throw the public retry message.

Wire:

```ts
await smtpBreaker.run(() =>
  withRetry(
    () => withTimeout(transporter().sendMail({ ... }), 10_000, "smtp"),
    { retries: 3, delayMs: 400 },
  ),
);
```

For OpenAI, wrap `generateText(...)` the same way with 15s timeout. Keep existing “AI not configured” / heuristic fallback in `lib/ai/copilot.ts` — a timeout must look like a provider miss, **not** a fake “department created”.

**Never** wrap `createEmployeeAction`’s Prisma transaction in the SMTP circuit. Mail stays after commit (already true at `lib/actions/people/employees.ts` ~730).

**Step 4: Run tests**

Run: `npx tsx --test lib/shared/resilience.test.ts lib/shared/mail.test.ts lib/ai/copilot.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/shared/resilience.ts lib/shared/resilience.test.ts lib/shared/mail.ts lib/ai/client.ts package.json
git commit -m "feat: timeout, retry, and circuit-break SMTP and OpenAI"
```

---

### Task 8: Claim payslips before sending so overlapping cron cannot double-email

**Files:**
- Modify: `prisma/schema.prisma` (`Payslip.sendingAt DateTime?`)
- Create: `prisma/migrations/<timestamp>_payslip_sending_at/migration.sql`
- Modify: `lib/payroll/deliver-payslips.ts`
- Create: `lib/payroll/deliver-payslips.test.ts` (claim helper, no live SMTP)

**Step 1: Write the failing test for the claim predicate**

Extract `STALE_CLAIM_MS = 10 * 60 * 1000` and:

```ts
export function canClaimPayslip(slip: { sentAt: Date | null; sendingAt: Date | null }, now = new Date()) {
  if (slip.sentAt) return false;
  if (!slip.sendingAt) return true;
  return now.getTime() - slip.sendingAt.getTime() >= STALE_CLAIM_MS;
}
```

Tests: skipped if `sentAt` set; claimable if `sendingAt` null; claimable if `sendingAt` older than 10 minutes; not claimable if `sendingAt` is 1 minute old.

**Step 2: Run to verify fail**

Run: `npx tsx --test lib/payroll/deliver-payslips.test.ts`

Expected: FAIL.

**Step 3: Schema + claim SQL**

Add `sendingAt DateTime?` on `Payslip`. Migration:

```sql
ALTER TABLE "payslip" ADD COLUMN "sendingAt" TIMESTAMP(3);
CREATE INDEX "payslip_sendingAt_idx" ON "payslip"("sendingAt");
```

In `deliverUnsentPayslip`, **before** SMTP:

```ts
const claimed = await prisma.payslip.updateMany({
  where: {
    id: slip.id,
    sentAt: null,
    OR: [{ sendingAt: null }, { sendingAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } }],
  },
  data: { sendingAt: new Date() },
});
if (claimed.count !== 1) return "skipped";
```

Then send mail. On success, `update({ sentAt: new Date(), sendingAt: null })`. On failure, `update({ sendingAt: null })` so the next run can retry.

Bump `PRISMA_GENERATION` after `npx prisma generate`.

**Step 4: Cron auth**

In `app/api/cron/payslips/route.ts`, **delete** the `url.searchParams.get("secret")` branch. Bearer only. Document the schedule in a short comment: caller (Render cron / GitHub Action / host crontab) should hit `POST /api/cron/payslips` monthly; the handler is safe to re-run because of the claim.

**Step 5: Run tests + generate**

Run:

```
npx prisma generate
npx tsx --test lib/payroll/deliver-payslips.test.ts
npm test
```

Expected: PASS.

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/payroll/deliver-payslips.ts lib/payroll/deliver-payslips.test.ts app/api/cron/payslips/route.ts lib/db.ts package.json
git commit -m "fix: claim payslip rows before SMTP so overlapping cron cannot double-send"
```

---

### Task 9: Client connectivity banner and copilot draft restore

**Files:**
- Create: `components/system/connectivity-banner.tsx`
- Modify: `components/layout/app-chrome.tsx` (render banner above `<main>`)
- Modify: `components/ai/copilot-widget.tsx`
- Modify: `components/auth/login-form.tsx`

Follow DESIGN.md: banner is a slim `border-border bg-surface` strip, amber **badge** only if you need status color — not a blue bar.

**Step 1:** Banner listens to `window` `online` / `offline`. When offline: “You are offline. Changes will not save until you reconnect.” Disable submit buttons that call server actions (login + copilot send). Do not queue writes in IndexedDB — that invents a sync protocol.

**Step 2: Copilot draft**

`sessionStorage` key `hrms.copilot.draft`. Persist `question` on change. Restore on mount. Clear after a successful send. Existing conversation messages already live in Postgres (`CopilotConversation`) — do not duplicate the transcript in `localStorage`.

**Step 3: Login**

If `handleSubmit` throws (network), set error to the public retry string from Task 1, `setPending(false)` in `finally` so a crash mid-await cannot leave the button stuck. Today `setPending(false)` is only on the happy/error result path — a thrown fetch leaves `pending === true` forever.

```ts
try {
  setPending(true);
  const result = await signInAction(...);
  ...
} catch {
  setError("The service is temporarily unavailable. Please retry in a moment.");
} finally {
  setPending(false);
}
```

**Step 4: Verify in the browser**

1. Open `/admin` with copilot permission, type a draft, refresh — textarea restores.
2. Chrome DevTools → Offline → banner shows; copilot Send disabled; login submit disabled.
3. Online again — banner gone; send works.

**Step 5: Commit**

```bash
git add components/system/connectivity-banner.tsx components/layout/app-chrome.tsx components/ai/copilot-widget.tsx components/auth/login-form.tsx
git commit -m "feat: show offline state and restore unsent copilot drafts"
```

---

### Task 10: Idempotency keys for unsafe writes

Attendance clock-in is already unique per `(userId, date)`. Payslip compute is unique per `(payrunId, employeeId)`. The remaining double-submit risks are **create employee**, **apply leave**, and **v1 POST** after a client retry.

**Files:**
- Modify: `prisma/schema.prisma` (new model)
- Create: migration
- Create: `lib/shared/idempotency.ts`
- Create: `lib/shared/idempotency.test.ts` (hash + replay helpers with a fake store)
- Modify: `lib/actions/people/employees.ts` `createEmployeeAction`
- Modify: leave-apply action (the existing apply function under `lib/actions/` — search `createLeave` / `applyLeave`)
- Modify: `lib/api/v1/dispatch.ts` to read `Idempotency-Key` on POST/PATCH/PUT

**Schema:**

```prisma
model IdempotencyRecord {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  action         String
  key            String
  requestHash    String
  responseJson   Json
  createdAt      DateTime @default(now())

  @@unique([userId, action, key])
  @@index([createdAt])
  @@map("idempotency_record")
}
```

**Behavior:**

1. Client generates `crypto.randomUUID()` once per submit (ref, not per render). Send as optional `idempotencyKey` on the two actions and as `Idempotency-Key` on v1 writes.
2. Server hashes the canonical request body. Same key + same hash → return stored `ActionResult` (replay). Same key + different hash → `{ ok: false, error: "Idempotency key was reused with a different request." }`.
3. TTL: ignore (or delete) records older than 24h in the lookup; optional later cron. Do not add Redis.

Keep the helper tiny. Do **not** wrap every server action in this pass — only create employee, leave apply, and v1 mutating dispatch.

**Tests:** hash stability; replay vs conflict. After Prisma generate, bump `PRISMA_GENERATION`.

**Commit:**

```bash
git commit -m "feat: replay identical writes from an idempotency key"
```

---

### Task 11: Rate-limit login, copilot, and v1 (single-instance)

**Files:**
- Create: `lib/shared/rate-limit.ts`
- Create: `lib/shared/rate-limit.test.ts`
- Modify: `lib/actions/auth.ts` (`signInAction`)
- Modify: `lib/actions/ai.ts` (`askHrCopilot`)
- Modify: `lib/api/v1/dispatch.ts`

In-memory sliding window, keyed by `${bucket}:${ip or userId}`. Limits (start here, constants at top of file):

| Bucket | Limit |
| --- | --- |
| `auth.signin` | 10 / 10 min / IP |
| `ai.copilot` | 30 / 10 min / user |
| `api.v1` | 120 / min / user (or IP if public health — **skip** `/health` and `/ready`) |

On exceed: `{ ok: false, error: "Too many requests. Try again shortly." }` and HTTP 429 in `statusForActionError`.

Document in a comment: multiple Node instances each have their own counter. That is acceptable until a host adds a shared store.

**Tests:** 3 hits with limit 2 → third denied; window expiry with a fake `now`.

**Commit:**

```bash
git commit -m "feat: rate-limit sign-in, copilot, and the v1 API"
```

---

### Task 12: Operator checklist (no new product surface)

**Files:**
- Create: `docs/ops/fault-tolerance.md`

Write only what this repo can actually do:

1. Point production `DATABASE_URL` at managed Postgres with HA / PITR (Neon, RDS, Render Postgres). The app cannot fake multi-AZ.
2. Platform health: probe `GET /api/v1/health` (liveness) and `GET /api/v1/ready` (Postgres).
3. Do **not** run `prisma migrate deploy` as a side effect of `next start`. Migrations are a separate release step.
4. Schedule `POST /api/cron/payslips` with `Authorization: Bearer $CRON_SECRET` only.
5. Set `DB_POOL_MAX` from the host’s connection budget (Neon pooler vs direct).
6. SMTP and `OPENAI_API_KEY` are optional at runtime; HR writes must succeed without them.

**Commit:**

```bash
git add docs/ops/fault-tolerance.md
git commit -m "docs: record health probes and HA expectations for operators"
```

---

## Suggested order

Do Tasks 1–6 before 7–11. Task 1 changes every user-visible failure string. Task 8 needs a migration, so run it when you can apply Prisma to the shared database. Task 12 can land anytime after 4.

## What this still will not survive

- Browser crash **before** the request is sent (draft restore covers copilot text only)
- Permanent Postgres loss (need backups / PITR on the host)
- Compromise of `CRON_SECRET` or `DATABASE_URL`
- Two Node processes without a shared rate-limit store (limits are per process)
- OpenAI or Gmail outages that last longer than the circuit reset — copilot falls back; payslip email retries on the next cron claim
