/**
 * Make the demo organization ready to present: fill attendance up to today,
 * keep leave/approvals/payroll work waiting, and free the demo logins to clock
 * in today.
 *
 * Run: npm run db:demo-ready            (resets today's clock-in for demo logins)
 *      npm run db:demo-ready -- --keep-today   (keep their clock-ins)
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { refreshDemoOrganization } from "../lib/demo/refresh";

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: "COMPANY" } });
  if (!org) throw new Error('Demo organization "COMPANY" not found. Run npm run db:seed first.');
  const report = await refreshDemoOrganization(org.id, {
    resetDemoLogins: !process.argv.includes("--keep-today"),
  });
  for (const [key, value] of Object.entries(report)) console.log(`${key}: ${value}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
