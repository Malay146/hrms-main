import { prisma } from "@/lib/db";
import { refreshDemoOrganization } from "@/lib/demo/refresh";
import { logger } from "@/lib/shared/logger";

/**
 * Daily demo upkeep (see lib/demo/refresh.ts). Only runs when DEMO_MODE=true,
 * and only for the seeded demo organization.
 */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.DEMO_MODE !== "true") {
    return Response.json({ skipped: "DEMO_MODE is not enabled" });
  }
  const org = await prisma.organization.findFirst({ where: { slug: "COMPANY" }, select: { id: true } });
  if (!org) return Response.json({ skipped: "no demo organization" });
  const report = await refreshDemoOrganization(org.id);
  logger.info("cron.demo_refreshed", report);
  return Response.json(report);
}

export const maxDuration = 60;

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
