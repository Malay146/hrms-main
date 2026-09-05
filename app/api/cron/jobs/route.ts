import { issueMonthEndPayslips } from "@/lib/payroll/deliver-payslips";
import { processBackgroundJobs } from "@/lib/jobs/queue";
import { logger } from "@/lib/shared/logger";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || "5")));
  const processed = await processBackgroundJobs(limit);
  logger.info("cron.jobs_processed", { count: processed.length, processed });
  return Response.json({ processed });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
