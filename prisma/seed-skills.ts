/**
 * Seed Workforce AI demo data: role skill requirements for common job titles,
 * and skill profiles for employees in those roles.
 *
 * Safe to re-run. Requirements are upserted; an employee who already has any
 * skills (for example ones they entered themselves) is left untouched.
 *
 * Run: npm run db:seed-skills
 */
import "dotenv/config";
import { prisma } from "../lib/db";

const ROLE_SKILLS: Record<string, [skill: string, target: number][]> = {
  "Frontend Engineer": [["React", 4], ["TypeScript", 4], ["Accessibility", 3], ["Testing", 3]],
  "Backend Engineer": [["Node.js", 4], ["PostgreSQL", 4], ["API Design", 4], ["Observability", 3]],
  "Full Stack Engineer": [["React", 3], ["Node.js", 4], ["PostgreSQL", 3], ["TypeScript", 4]],
  "Mobile Engineer": [["React Native", 4], ["TypeScript", 3], ["App Store Release", 3], ["Testing", 3]],
  "Staff Engineer": [["System Design", 5], ["Mentoring", 4], ["Code Review", 4], ["Observability", 4]],
  "QA Engineer": [["Test Automation", 4], ["Playwright", 3], ["Test Planning", 4], ["SQL", 2]],
  "Product Manager": [["Roadmapping", 4], ["User Research", 3], ["Analytics", 3], ["Stakeholder Management", 4]],
  "Product Owner": [["Backlog Management", 4], ["User Stories", 4], ["Stakeholder Management", 3], ["Analytics", 2]],
  "Product Designer": [["Figma", 4], ["User Research", 3], ["Prototyping", 4], ["Design Systems", 3]],
  "CS Manager": [["Account Management", 4], ["Coaching", 4], ["Churn Analysis", 3], ["CRM", 3]],
  "Onboarding Specialist": [["Product Knowledge", 4], ["Training Delivery", 3], ["CRM", 3], ["Documentation", 3]],
  "Growth Marketer": [["SEO", 3], ["Paid Acquisition", 4], ["Analytics", 4], ["Copywriting", 3]],
  "Facilities Lead": [["Vendor Management", 4], ["Budgeting", 3], ["Health & Safety", 4], ["Scheduling", 3]],
  "Ops Coordinator": [["Scheduling", 4], ["Spreadsheets", 4], ["Vendor Management", 3], ["Documentation", 3]],
  // Job titles of the demo logins, so each one sees a populated skill view.
  "Engineering Lead": [["System Design", 4], ["People Management", 4], ["Code Review", 4], ["Hiring", 3]],
  "HR Generalist": [["Employee Relations", 4], ["Labour Law", 3], ["HRIS", 3], ["Onboarding", 3]],
  "Payroll Specialist": [["Payroll Processing", 4], ["Statutory Compliance", 4], ["Spreadsheets", 4], ["HRIS", 3]],
  "Sales Executive": [["Prospecting", 4], ["Negotiation", 3], ["CRM", 3], ["Product Knowledge", 3]],
};

/** Stable pseudo-random number in [0, 1) from a string, so re-runs give the same data. */
function hash01(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: "COMPANY" } });
  if (!org) throw new Error('Demo organization "COMPANY" not found. Run npm run db:seed first.');

  let requirements = 0;
  for (const [jobTitle, skills] of Object.entries(ROLE_SKILLS)) {
    for (const [skillName, targetLevel] of skills) {
      await prisma.roleSkillRequirement.upsert({
        where: { organizationId_jobTitle_skillName: { organizationId: org.id, jobTitle, skillName } },
        update: {},
        create: { organizationId: org.id, jobTitle, skillName, targetLevel },
      });
      requirements += 1;
    }
  }

  const profiles = await prisma.employeeProfile.findMany({
    where: {
      organizationId: org.id,
      role: "employee",
      jobTitle: { in: Object.keys(ROLE_SKILLS) },
      skills: { none: {} },
    },
    select: { id: true, jobTitle: true },
  });

  const rows = profiles.flatMap((profile) =>
    ROLE_SKILLS[profile.jobTitle].flatMap(([skill, target]) => {
      const roll = hash01(`${profile.id}:${skill}`);
      if (roll < 0.1) return []; // about one in ten never listed this skill
      // Mostly at or near target, with some clear gaps to make the view useful.
      const offset = roll < 0.35 ? -2 : roll < 0.65 ? -1 : roll < 0.9 ? 0 : 1;
      const proficiency = Math.min(5, Math.max(1, target + offset));
      return [{ employeeId: profile.id, name: skill, proficiency }];
    }),
  );
  if (rows.length > 0) await prisma.employeeSkill.createMany({ data: rows, skipDuplicates: true });

  console.log(`role requirements: ${requirements}`);
  console.log(`employees given skills: ${profiles.length}`);
  console.log(`skill rows created: ${rows.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
