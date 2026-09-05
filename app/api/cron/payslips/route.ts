import { issueMonthEndPayslips } from "@/lib/payroll/deliver-payslips";
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
  const month = url.searchParams.get("month") || undefined;
  const result = await issueMonthEndPayslips(month);
  logger.info("cron.payslips_issued", result);
  return Response.json(result);
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
