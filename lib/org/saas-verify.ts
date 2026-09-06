/**
 * Live SaaS verification: DB bootstrap + HTTP pages/API.
 * Run: npx tsx lib/org/saas-verify.ts
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../db";
import { bootstrapNewOrganization } from "./bootstrap";
import { allocateOrgSlug, nextEmployeeId } from "../people/employee-id";
import { kolkataParts } from "../shared/dates";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const EMAIL = `saas.verify.${stamp}@example.com`;
const PASSWORD = "SaasTest1!";
const ORG_NAME = `SaaS Verify ${stamp}`;

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function destroyByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: { select: { organizationId: true } } },
  });
  const orgId = user?.profile?.organizationId;
  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
  }
  if (orgId) {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
  }
}

function cookieHeader(setCookie: string[]) {
  return setCookie
    .map((row) => row.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function main() {
  const oddoBefore = await prisma.organization.findUnique({
    where: { slug: "ODDO" },
    select: { id: true, _count: { select: { profiles: true } } },
  });
  record(
    "Oddo demo tenant still exists",
    Boolean(oddoBefore),
    oddoBefore ? `${oddoBefore._count.profiles} profiles` : "ODDO missing",
  );

  // --- DB: bootstrap a tenant the same way signup does (no Next headers) ---
  const slug = allocateOrgSlug(ORG_NAME, (await prisma.organization.findMany({ select: { slug: true } })).map((r) => r.slug));
  const year = kolkataParts().year;
  const employeeId = nextEmployeeId(slug, year, []);
  const passwordHash = await hashPassword(PASSWORD);
  const userId = crypto.randomUUID();
  const now = new Date();

  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: ORG_NAME, email: EMAIL, slug },
    });
    const { departmentId, scheduleId } = await bootstrapNewOrganization(tx, org.id);
    await tx.user.create({
      data: {
        id: userId,
        name: "Verify Admin",
        email: EMAIL,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: "admin",
        mustChangePassword: false,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: userId,
            providerId: "credential",
            issuer: "local:credential",
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
          },
        },
        profile: {
          create: {
            organizationId: org.id,
            employeeId,
            fullName: "Verify Admin",
            role: "admin",
            departmentId,
            jobTitle: "Administrator",
            status: "active",
            paidLeaveBalance: 20,
            employeeType: "full_time",
            scheduleId,
          },
        },
      },
    });
    return org;
  });

  const [deptCount, typeCount, scheduleCount, ruleCount, profileCount, oddoAfter] = await Promise.all([
    prisma.department.count({ where: { organizationId: organization.id } }),
    prisma.timeOffType.count({ where: { organizationId: organization.id } }),
    prisma.workingSchedule.count({ where: { organizationId: organization.id } }),
    prisma.salaryRule.count({ where: { structure: { organizationId: organization.id } } }),
    prisma.employeeProfile.count({ where: { organizationId: organization.id } }),
    prisma.employeeProfile.count({ where: { organizationId: oddoBefore?.id } }),
  ]);

  record("Bootstrap creates 4 departments", deptCount === 4, String(deptCount));
  record("Bootstrap creates 3 time-off types", typeCount === 3, String(typeCount));
  record("Bootstrap creates a working schedule", scheduleCount === 1, String(scheduleCount));
  record("Bootstrap creates Regular Salary rules", ruleCount === 7, String(ruleCount));
  record("New tenant has exactly 1 employee (founder)", profileCount === 1, String(profileCount));
  record(
    "Oddo headcount unchanged after new tenant",
    oddoAfter === (oddoBefore?._count.profiles ?? -1),
    `before=${oddoBefore?._count.profiles} after=${oddoAfter}`,
  );

  const leaked = await prisma.department.findMany({
    where: { organizationId: organization.id, name: "Human Resources" },
  });
  const oddoHr = oddoBefore
    ? await prisma.department.findMany({
        where: { organizationId: oddoBefore.id, name: "Human Resources" },
      })
    : [];
  record(
    "New HR department is not the Oddo HR row",
    leaked[0]?.id !== oddoHr[0]?.id,
    `new=${leaked[0]?.id} oddo=${oddoHr[0]?.id}`,
  );

  // Duplicate email path (same check as the action)
  const duplicate = await prisma.user.findUnique({ where: { email: "admin@oddo.com" } });
  record("Duplicate Oddo admin email is detected", Boolean(duplicate), duplicate?.email ?? "missing");

  // --- HTTP ---
  let httpOk = false;
  try {
    const landing = await fetch(`${BASE}/`);
    const landingHtml = await landing.text();
    httpOk = landing.ok;
    record(
      "Landing shows Register organization",
      landing.ok && landingHtml.includes("Register organization"),
      `status=${landing.status}`,
    );

    const login = await fetch(`${BASE}/login`);
    const loginHtml = await login.text();
    record(
      "Login page links to /sign-up",
      login.ok && loginHtml.includes("/sign-up") && loginHtml.includes("Register an organization"),
      `status=${login.status}`,
    );

    const signup = await fetch(`${BASE}/sign-up`, { redirect: "manual" });
    const signupHtml = signup.status === 200 ? await signup.text() : "";
    record(
      "/sign-up is public (200, not redirect to login)",
      signup.status === 200 && signupHtml.includes("Register your organization"),
      `status=${signup.status}`,
    );

    const gated = await fetch(`${BASE}/admin`, { redirect: "manual" });
    record(
      "Unauthenticated /admin still redirects to login",
      gated.status === 307 || gated.status === 302,
      `status=${gated.status} loc=${gated.headers.get("location")}`,
    );

    const catalog = await fetch(`${BASE}/api/v1/openapi.json`);
    const spec = catalog.ok ? ((await catalog.json()) as { paths?: Record<string, unknown> }) : {};
    record(
      "OpenAPI includes POST /api/v1/organizations",
      Boolean(spec.paths?.["/api/v1/organizations"]),
      catalog.status.toString(),
    );

    const mismatch = await fetch(`${BASE}/api/v1/organizations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "X",
        organizationName: "Nope Co",
        organizationEmail: `mismatch.${stamp}@example.com`,
        password: "Secret123",
        confirmPassword: "Other123",
      }),
    });
    const mismatchJson = (await mismatch.json()) as { ok?: boolean; error?: string };
    record(
      "API rejects mismatched passwords",
      mismatch.ok === false && /match/i.test(mismatchJson.error ?? ""),
      JSON.stringify(mismatchJson),
    );

    const taken = await fetch(`${BASE}/api/v1/organizations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Admin",
        organizationName: "Should Fail",
        organizationEmail: "admin@oddo.com",
        password: "Secret123",
        confirmPassword: "Secret123",
      }),
    });
    const takenJson = (await taken.json()) as { ok?: boolean; error?: string };
    record(
      "API rejects Oddo admin email",
      takenJson.ok === false && /already exists/i.test(takenJson.error ?? ""),
      JSON.stringify(takenJson),
    );

    const apiEmail = `saas.api.${stamp}@example.com`;
    const created = await fetch(`${BASE}/api/v1/organizations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "API Founder",
        organizationName: `API Tenant ${stamp}`,
        organizationEmail: apiEmail,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      }),
    });
    const createdJson = (await created.json()) as {
      ok?: boolean;
      error?: string;
      data?: { redirectTo?: string; role?: string };
    };
    record(
      "API register creates tenant (ok or sign-in-later message)",
      createdJson.ok === true || /Organization created/i.test(createdJson.error ?? ""),
      JSON.stringify(createdJson).slice(0, 240),
    );

    const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: apiEmail, password: PASSWORD }),
    });
    const setCookie = signIn.headers.getSetCookie?.() ?? [];
    const cookie = cookieHeader(setCookie);
    record(
      "Founder can sign in after register",
      signIn.ok && cookie.includes("better-auth"),
      `status=${signIn.status} cookies=${setCookie.length}`,
    );

    if (cookie) {
      const me = await fetch(`${BASE}/api/v1/me`, { headers: { cookie } });
      const meJson = (await me.json()) as {
        ok?: boolean;
        data?: { organizationId?: string | null; organizationName?: string | null; role?: string; email?: string };
      };
      record(
        "Session exposes organizationId for the new tenant",
        me.ok && meJson.ok === true && Boolean(meJson.data?.organizationId) && meJson.data?.email === apiEmail,
        JSON.stringify(meJson.data ?? meJson).slice(0, 240),
      );

      const people = await fetch(`${BASE}/api/v1/employees?pageSize=60`, { headers: { cookie } });
      const peopleJson = (await people.json()) as {
        ok?: boolean;
        data?: { items?: { email?: string }[]; rows?: { email?: string }[] };
      };
      const rows = peopleJson.data?.items ?? peopleJson.data?.rows ?? [];
      const emails = rows.map((row) => row.email);
      record(
        "Employee list is tenant-scoped (no Oddo emails)",
        people.ok &&
          peopleJson.ok === true &&
          !emails.includes("admin@oddo.com") &&
          emails.every((value) => value === apiEmail || !value?.endsWith("@oddo.com")),
        `count=${rows.length} emails=${emails.slice(0, 5).join(",")}`,
      );
    } else {
      record("Founder can sign in after register", false, "no session cookie");
      record("Session exposes organizationId for the new tenant", false, "skipped");
      record("Employee list is tenant-scoped (no Oddo emails)", false, "skipped");
    }

    await destroyByEmail(apiEmail);
  } catch (error) {
    record("HTTP suite ran", false, error instanceof Error ? error.message : String(error));
  }

  if (!httpOk) {
    record("Dev server reachable", false, `Could not load ${BASE}`);
  }

  await destroyByEmail(EMAIL);

  const leftover = await prisma.user.findUnique({ where: { email: EMAIL } });
  record("Cleanup removed DB bootstrap tenant", !leftover, leftover ? "user still present" : "removed");

  const failed = checks.filter((row) => !row.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
