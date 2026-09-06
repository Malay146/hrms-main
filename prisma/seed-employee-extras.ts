/**
 * Seed visible employee payslips + submitted performance reviews for demo accounts.
 * Run: npx tsx prisma/seed-employee-extras.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { dateFromKey } from "../lib/shared/dates";
import { computePayslip } from "../lib/payroll/compute";
import { REGULAR_SALARY_RULES } from "../lib/payroll/regular-salary";

const DEMO_EMAILS = [
  "john.cena@oddo.com",
  "bruce.banner@oddo.com",
  "sarah.mills@oddo.com",
  "william.joseph@oddo.com",
  "mark.lou@oddo.com",
];

const MONTHS = [
  { name: "June 2026", start: "2026-06-01", end: "2026-06-30", status: "paid" as const },
  { name: "July 2026", start: "2026-07-01", end: "2026-07-31", status: "paid" as const },
  { name: "August 2026", start: "2026-08-01", end: "2026-08-31", status: "validated" as const },
];

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization");

  const structure = await prisma.salaryStructure.findFirst({
    where: { organizationId: org.id, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!structure) throw new Error("No salary structure");

  const hr = await prisma.employeeProfile.findFirst({
    where: { organizationId: org.id, role: { in: ["hr_manager", "admin"] } },
    select: { id: true },
  });

  let cycle = await prisma.performanceCycle.findFirst({
    where: { organizationId: org.id, name: "Q3 2026" },
  });
  if (!cycle) {
    cycle = await prisma.performanceCycle.create({
      data: {
        organizationId: org.id,
        name: "Q3 2026",
        periodStart: dateFromKey("2026-07-01"),
        periodEnd: dateFromKey("2026-09-30"),
        status: "open",
      },
    });
  }

  let q4 = await prisma.performanceCycle.findFirst({
    where: { organizationId: org.id, name: "Q4 2026" },
  });
  if (!q4) {
    q4 = await prisma.performanceCycle.create({
      data: {
        organizationId: org.id,
        name: "Q4 2026",
        periodStart: dateFromKey("2026-10-01"),
        periodEnd: dateFromKey("2026-12-31"),
        status: "open",
      },
    });
  }

  const profiles = await prisma.employeeProfile.findMany({
    where: { user: { email: { in: DEMO_EMAILS } } },
    select: {
      id: true,
      fullName: true,
      wage: true,
      user: { select: { email: true } },
      contracts: {
        where: { status: "running" },
        take: 1,
        select: { id: true },
      },
    },
  });

  let payslipsCreated = 0;
  for (const month of MONTHS) {
    let payrun = await prisma.payrun.findFirst({
      where: { organizationId: org.id, name: month.name },
    });
    if (!payrun) {
      payrun = await prisma.payrun.create({
        data: {
          organizationId: org.id,
          name: month.name,
          structureId: structure.id,
          periodStart: dateFromKey(month.start),
          periodEnd: dateFromKey(month.end),
          status: month.status === "paid" ? "paid" : "validated",
        },
      });
    }

    for (const [index, profile] of profiles.entries()) {
      const existing = await prisma.payslip.findFirst({
        where: { payrunId: payrun.id, employeeId: profile.id },
      });
      if (existing) continue;

      const wage = Number(profile.wage ?? 45000 + index * 2500);
      const workedDays = 20 + (index % 3);
      const computed = computePayslip(REGULAR_SALARY_RULES, {
        wage,
        workedDays,
        scheduledDays: 22,
        unpaidLeaveDays: Math.max(0, 22 - workedDays),
      });

      await prisma.payslip.create({
        data: {
          payrunId: payrun.id,
          employeeId: profile.id,
          contractId: profile.contracts[0]?.id ?? null,
          workedDays,
          status: month.status,
          wage,
          gross: computed.gross,
          net: computed.net,
          warning: null,
          lines: {
            create: computed.lines.map((line) => ({
              name: line.name,
              code: line.code,
              category: line.category,
              amount: line.amount,
            })),
          },
        },
      });
      payslipsCreated += 1;
    }
  }

  let reviewsUpdated = 0;
  for (const [index, profile] of profiles.entries()) {
    const q3 = await prisma.performanceReview.findUnique({
      where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: profile.id } },
      include: { goals: true },
    });

    const status = index % 2 === 0 ? "submitted" : "acknowledged";
    const rating = 3.5 + (index % 3) * 0.5;

    if (!q3) {
      await prisma.performanceReview.create({
        data: {
          cycleId: cycle.id,
          employeeId: profile.id,
          reviewerId: hr?.id ?? null,
          status,
          overallRating: rating,
          summary: `${profile.fullName} delivered solid results this cycle with clear ownership.`,
          employeeComments: status === "acknowledged" ? "Appreciate the feedback — will keep momentum." : "",
          submittedAt: new Date(),
          acknowledgedAt: status === "acknowledged" ? new Date() : null,
          goals: {
            create: [
              {
                title: "Delivery quality",
                description: "Ship assigned work with low rework.",
                progress: 75 + (index % 4) * 5,
                status: "completed",
              },
              {
                title: "Collaboration",
                description: "Support cross-team handoffs and reviews.",
                progress: 55 + (index % 5) * 5,
                status: "in_progress",
              },
              {
                title: "Growth",
                description: "Pick up one new skill relevant to the role.",
                progress: 40 + (index % 3) * 10,
                status: "in_progress",
              },
            ],
          },
        },
      });
      reviewsUpdated += 1;
      continue;
    }

    await prisma.performanceReview.update({
      where: { id: q3.id },
      data: {
        status,
        overallRating: q3.overallRating ?? rating,
        summary:
          q3.summary?.trim() ||
          `${profile.fullName} delivered solid results this cycle with clear ownership.`,
        employeeComments:
          status === "acknowledged"
            ? q3.employeeComments || "Appreciate the feedback — will keep momentum."
            : q3.employeeComments,
        reviewerId: q3.reviewerId ?? hr?.id ?? null,
        submittedAt: q3.submittedAt ?? new Date(),
        acknowledgedAt: status === "acknowledged" ? q3.acknowledgedAt ?? new Date() : null,
      },
    });

    if (q3.goals.length < 3) {
      await prisma.performanceGoal.create({
        data: {
          reviewId: q3.id,
          title: "Growth",
          description: "Pick up one new skill relevant to the role.",
          progress: 45,
          status: "in_progress",
        },
      });
    }
    reviewsUpdated += 1;

    // Ensure Q4 draft exists for in-progress visibility on admin side only
    const existingQ4 = await prisma.performanceReview.findUnique({
      where: { cycleId_employeeId: { cycleId: q4.id, employeeId: profile.id } },
    });
    if (!existingQ4) {
      await prisma.performanceReview.create({
        data: {
          cycleId: q4.id,
          employeeId: profile.id,
          reviewerId: hr?.id ?? null,
          status: "draft",
          summary: "",
          goals: {
            create: [
              {
                title: "Q4 priorities",
                description: "Align with team OKRs for the next quarter.",
                progress: 15,
                status: "not_started",
              },
            ],
          },
        },
      });
    }
  }

  console.log(`Payslips created: ${payslipsCreated}`);
  console.log(`Performance reviews upserted: ${reviewsUpdated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
