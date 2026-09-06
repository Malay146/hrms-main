import type { Prisma } from "@/generated/prisma/client";
import { REGULAR_SALARY_RULES } from "@/lib/payroll/regular-salary";
import { departmentCodeFromName } from "@/lib/people/department-code";
import { lineHours, weeklyHours } from "@/lib/people/schedule-hours";

export const NEW_ORG_DEPARTMENTS = [
  "Human Resources",
  "Engineering",
  "Finance",
  "Operations",
] as const;

export const NEW_ORG_TIME_OFF = [
  { name: "Paid Time Off", code: "paid", requiresAllocation: true },
  { name: "Sick Leave", code: "sick", requiresAllocation: false },
  { name: "Unpaid Leave", code: "unpaid", requiresAllocation: false },
] as const;

const STANDARD_WEEKDAYS = [1, 2, 3, 4, 5];
const STANDARD_START = 9 * 60;
const STANDARD_END = 18 * 60;
const STANDARD_BREAK = 60;

type OrgDb = Prisma.TransactionClient;

export async function bootstrapNewOrganization(
  db: OrgDb,
  organizationId: string,
): Promise<{ departmentId: string; scheduleId: string }> {
  const departments: Record<string, string> = {};
  for (const name of NEW_ORG_DEPARTMENTS) {
    const row = await db.department.create({
      data: {
        organizationId,
        name,
        code: departmentCodeFromName(name),
      },
    });
    departments[name] = row.id;
  }

  for (const def of NEW_ORG_TIME_OFF) {
    await db.timeOffType.create({
      data: {
        organizationId,
        name: def.name,
        code: def.code,
        requiresAllocation: def.requiresAllocation,
      },
    });
  }

  const lines = STANDARD_WEEKDAYS.map((weekday) => ({
    weekday,
    startMin: STANDARD_START,
    endMin: STANDARD_END,
    breakMin: STANDARD_BREAK,
    hours: lineHours(STANDARD_START, STANDARD_END, STANDARD_BREAK),
  }));

  const schedule = await db.workingSchedule.create({
    data: {
      organizationId,
      name: "Standard Office (Mon–Fri)",
      calendarType: "fixed",
      timezone: "Asia/Kolkata",
      active: true,
      hoursPerWeek: weeklyHours(lines),
      daysPerWeek: lines.length,
      lines: { create: lines },
    },
  });

  await db.salaryStructure.create({
    data: {
      organizationId,
      name: "Regular Salary",
      active: true,
      rules: {
        create: REGULAR_SALARY_RULES.map((rule) => ({
          name: rule.name,
          code: rule.code,
          category: rule.category,
          sequence: rule.sequence,
          computation: rule.computation,
          amount: rule.amount ?? null,
          percentage: rule.percentage ?? null,
          percentBaseCode: rule.percentBaseCode ?? null,
          formula: rule.formula ?? null,
        })),
      },
    },
  });

  const departmentId = departments["Human Resources"];
  if (!departmentId) {
    throw new Error("Human Resources department was not created.");
  }

  return { departmentId, scheduleId: schedule.id };
}
