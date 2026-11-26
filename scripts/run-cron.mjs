#!/usr/bin/env node
/**
 * Trigger a cron endpoint on a running app.
 *
 *   node scripts/run-cron.mjs payslips [YYYY-MM]   # email unsent month-end payslips
 *   node scripts/run-cron.mjs jobs                 # drain queued background jobs
 *
 * Reads CRON_SECRET and NEXT_PUBLIC_APP_URL (default http://localhost:3000) from .env.
 * Safe to run daily: payslips are only emailed once, and only for the closing month.
 */
import "dotenv/config";

const [job = "payslips", month] = process.argv.slice(2);
if (!["payslips", "jobs"].includes(job)) {
  console.error(`Unknown cron job "${job}". Use "payslips" or "jobs".`);
  process.exit(1);
}

const secret = process.env.CRON_SECRET?.trim();
if (!secret) {
  console.error("CRON_SECRET is not set in .env.");
  process.exit(1);
}

const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const url = new URL(`/api/cron/${job}`, base);
if (month) url.searchParams.set("month", month);

const response = await fetch(url, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
}).catch((error) => {
  console.error(`Could not reach ${base}. Is the app running? (${error.message})`);
  process.exit(1);
});

const body = await response.text();
console.log(`${response.status} ${body}`);
process.exit(response.ok ? 0 : 1);
