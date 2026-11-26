"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  explainWorkforceReport,
  generateSkillRecommendations,
  generateWorkforce360Observations,
  interpretWorkforceReport,
} from "@/lib/ai/workforce";
import {
  canViewWorkforceProfile,
  getWorkforceActor,
  visibleEmployeeIds,
} from "@/lib/analytics/workforce-access";
import {
  calculateSkillGaps,
  isValidAnalyticsDateRange,
  isValidProficiency,
  summarizeAttendance,
  summarizeGoals,
} from "@/lib/analytics/workforce";
import type {
  RoleSkillRequirementItem,
  Workforce360Data,
  WorkforceDashboard,
  WorkforceEmployee,
  WorkforceReport,
} from "@/lib/analytics/workforce-types";
import { addDaysToKey } from "@/lib/ai/metrics";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { dateFromKey, kolkataTodayKey, toDateKey } from "@/lib/shared/dates";
import { enforceRateLimits, RATE_LIMITS, userRateKey } from "@/lib/shared/rate-limit";
import type { ActionResult } from "@/lib/shared/types";
import { logger } from "@/lib/shared/logger";

const skillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  proficiency: z.number().int().min(1).max(5),
});

const requirementSchema = z.object({
  jobTitle: z.string().trim().min(1).max(100),
  skillName: z.string().trim().min(1).max(80),
  targetLevel: z.number().int().min(1).max(5),
});

function isDuplicateSkillName(names: string[]) {
  return new Set(names.map((name) => name.trim().toLocaleLowerCase())).size !== names.length;
}

function parseTargetEmployeeId(employeeId: string | undefined, ownProfileId: string) {
  return z.string().trim().min(1).max(100).safeParse(employeeId ?? ownProfileId);
}

function summarizeDepartmentGaps(employees: WorkforceEmployee[]) {
  const grouped = new Map<string, { employees: number; employeesWithGaps: number; gapCount: number }>();
  for (const employee of employees) {
    const row = grouped.get(employee.department) ?? { employees: 0, employeesWithGaps: 0, gapCount: 0 };
    row.employees += 1;
    if (employee.gaps.length > 0) row.employeesWithGaps += 1;
    row.gapCount += employee.gaps.length;
    grouped.set(employee.department, row);
  }
  return [...grouped.entries()]
    .map(([name, values]) => ({ name, ...values }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

type ReportGroup = {
  count: number;
  total: number;
  completed: number;
  goalTotal: number;
  ratingCount: number;
  employees: Set<string>;
};

export async function getWorkforceDashboard(): Promise<ActionResult<WorkforceDashboard>> {
  try {
    const actor = await getWorkforceActor();
    const visibleIds = visibleEmployeeIds(actor);
    const [profiles, requirements] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: {
          organizationId: actor.organizationId,
          role: "employee",
          status: { not: "inactive" },
          ...(visibleIds ? { id: { in: visibleIds } } : {}),
        },
        select: {
          id: true,
          fullName: true,
          employeeId: true,
          jobTitle: true,
          department: { select: { name: true } },
          skills: { select: { name: true, proficiency: true }, orderBy: { name: "asc" } },
        },
        orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }],
      }),
      prisma.roleSkillRequirement.findMany({
        where: { organizationId: actor.organizationId },
        select: { id: true, jobTitle: true, skillName: true, targetLevel: true },
        orderBy: [{ jobTitle: "asc" }, { skillName: "asc" }],
      }),
    ]);

    const employees = profiles.map((profile): WorkforceEmployee => {
      const roleRequirements = requirements.filter(
        (requirement) => requirement.jobTitle.trim().toLocaleLowerCase() === profile.jobTitle.trim().toLocaleLowerCase(),
      );
      return {
        id: profile.id,
        name: profile.fullName,
        employeeCode: profile.employeeId,
        jobTitle: profile.jobTitle,
        department: profile.department.name,
        skills: profile.skills,
        gaps: calculateSkillGaps(roleRequirements, profile.skills),
      };
    });

    const access = actor.isHr ? "hr" : actor.directReportIds.length > 0 ? "manager" : "employee";
    return {
      ok: true,
      data: {
        access,
        ownProfileId: actor.profileId,
        employees,
        roleRequirements: requirements,
        departments: summarizeDepartmentGaps(employees),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load workforce insights.") };
  }
}

export async function saveMySkills(
  skills: { name: string; proficiency: number }[],
): Promise<ActionResult<{ saved: number }>> {
  try {
    const actor = await getWorkforceActor();
    if (actor.role !== "employee") {
      return { ok: false, error: "Only employees can update their own skill profile." };
    }
    if (!Array.isArray(skills) || skills.length > 40) {
      return { ok: false, error: "Enter no more than 40 skills." };
    }
    const parsed = z.array(skillSchema).safeParse(skills);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid skills." };
    if (isDuplicateSkillName(parsed.data.map((skill) => skill.name))) {
      return { ok: false, error: "Skill names must be unique." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeSkill.deleteMany({ where: { employeeId: actor.profileId } });
      if (parsed.data.length > 0) {
        await tx.employeeSkill.createMany({
          data: parsed.data.map((skill) => ({
            employeeId: actor.profileId,
            name: skill.name,
            proficiency: skill.proficiency,
          })),
        });
      }
    });
    revalidatePath("/employee/insights");
    revalidatePath("/admin/analytics/workforce");
    return { ok: true, data: { saved: parsed.data.length } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save your skills.") };
  }
}

export async function saveRoleSkillRequirement(
  input: { jobTitle: string; skillName: string; targetLevel: number },
): Promise<ActionResult<RoleSkillRequirementItem>> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    const actor = await getWorkforceActor();
    const parsed = requirementSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid requirement." };
    if (!isValidProficiency(parsed.data.targetLevel)) {
      return { ok: false, error: "Target proficiency must be between 1 and 5." };
    }
    const existing = await prisma.roleSkillRequirement.findFirst({
      where: {
        organizationId: actor.organizationId,
        jobTitle: { equals: parsed.data.jobTitle, mode: "insensitive" },
        skillName: { equals: parsed.data.skillName, mode: "insensitive" },
      },
      select: { id: true },
    });
    const saved = existing
      ? await prisma.roleSkillRequirement.update({
          where: { id: existing.id },
          data: { targetLevel: parsed.data.targetLevel },
          select: { id: true, jobTitle: true, skillName: true, targetLevel: true },
        })
      : await prisma.roleSkillRequirement.create({
          data: { organizationId: actor.organizationId, ...parsed.data },
          select: { id: true, jobTitle: true, skillName: true, targetLevel: true },
        });
    logger.info("workforce.role_skill_requirement_saved", { actorId: user.id });
    revalidatePath("/admin/analytics/workforce");
    revalidatePath("/employee/insights");
    return { ok: true, data: saved };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save the role requirement.") };
  }
}

export async function deleteRoleSkillRequirement(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("viewAiAnalytics");
    const actor = await getWorkforceActor();
    if (typeof id !== "string" || id.length > 100) return { ok: false, error: "Invalid requirement." };
    const deleted = await prisma.roleSkillRequirement.deleteMany({
      where: { id, organizationId: actor.organizationId },
    });
    if (deleted.count === 0) return { ok: false, error: "Requirement not found." };
    logger.info("workforce.role_skill_requirement_deleted", { actorId: user.id });
    revalidatePath("/admin/analytics/workforce");
    revalidatePath("/employee/insights");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not remove the role requirement.") };
  }
}

async function findVisibleEmployee(employeeId: string) {
  const actor = await getWorkforceActor();
  const profile = await prisma.employeeProfile.findFirst({
    where: { id: employeeId, organizationId: actor.organizationId, role: "employee" },
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      joinDate: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
  if (!profile || !canViewWorkforceProfile(actor, employeeId)) {
    return { actor, profile: null };
  }
  return { actor, profile };
}

function monthDifference(start: Date, end: Date) {
  return Math.max(
    0,
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth(),
  );
}

async function loadEmployee360(employeeId: string): Promise<Workforce360Data | null> {
  const { actor, profile } = await findVisibleEmployee(employeeId);
  if (!profile) return null;

  const today = kolkataTodayKey();
  const currentStart = addDaysToKey(today, -89);
  const previousStart = addDaysToKey(today, -179);
  const [attendance, approvedLeave, previousApprovedLeave, reviews] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        organizationId: actor.organizationId,
        employeeId: profile.id,
        date: { gte: dateFromKey(previousStart), lte: dateFromKey(today) },
      },
      select: { status: true, date: true },
      orderBy: { date: "asc" },
    }),
    prisma.leaveRequest.aggregate({
      where: {
        organizationId: actor.organizationId,
        employeeId: profile.id,
        status: "approved",
        startDate: { gte: dateFromKey(currentStart), lte: dateFromKey(today) },
        endDate: { lte: dateFromKey(today) },
      },
      _sum: { duration: true },
    }),
    prisma.leaveRequest.aggregate({
      where: {
        organizationId: actor.organizationId,
        employeeId: profile.id,
        status: "approved",
        startDate: { gte: dateFromKey(previousStart), lt: dateFromKey(currentStart) },
        endDate: { lt: dateFromKey(currentStart) },
      },
      _sum: { duration: true },
    }),
    prisma.performanceReview.findMany({
      where: {
        employeeId: profile.id,
        cycle: { organizationId: actor.organizationId },
        status: { in: ["submitted", "acknowledged"] },
      },
      select: {
        overallRating: true,
        cycle: { select: { periodEnd: true } },
        goals: { select: { progress: true } },
      },
      orderBy: { cycle: { periodEnd: "desc" } },
      take: 2,
    }),
  ]);
  const currentStatuses = attendance
    .filter((row) => toDateKey(row.date) >= currentStart)
    .map((row) => row.status);
  const previousStatuses = attendance
    .filter((row) => toDateKey(row.date) < currentStart)
    .map((row) => row.status);
  const currentAttendance = summarizeAttendance(currentStatuses);
  const previousAttendance = summarizeAttendance(previousStatuses);
  const goals = summarizeGoals(reviews[0]?.goals.map((goal) => goal.progress) ?? []);
  const previousGoals = summarizeGoals(reviews[1]?.goals.map((goal) => goal.progress) ?? []);

  let departmentComparison: Workforce360Data["departmentComparison"] = null;
  const visibleIds = visibleEmployeeIds(actor);
  const peers = await prisma.employeeProfile.findMany({
    where: {
      organizationId: actor.organizationId,
      role: "employee",
      status: { not: "inactive" },
      departmentId: profile.departmentId,
      ...(visibleIds ? { id: { in: visibleIds, not: profile.id } } : { id: { not: profile.id } }),
    },
    select: { id: true },
    take: 100,
  });
  if (peers.length >= 3) {
    const peerAttendance = await prisma.attendance.findMany({
      where: {
        organizationId: actor.organizationId,
        employeeId: { in: peers.map((peer) => peer.id) },
        date: { gte: dateFromKey(currentStart), lte: dateFromKey(today) },
      },
      select: { status: true },
    });
    const average = summarizeAttendance(peerAttendance.map((row) => row.status));
    departmentComparison = {
      sampleSize: peers.length,
      attendancePct: average.attendancePct,
    };
  }

  return {
    employeeId: profile.id,
    employeeName: profile.fullName,
    jobTitle: profile.jobTitle,
    department: profile.department.name,
    tenureMonths: profile.joinDate ? monthDifference(profile.joinDate, dateFromKey(today)) : null,
    periodLabel: `${currentStart} to ${today}`,
    attendance: {
      attendancePct: currentAttendance.attendancePct,
      absentDays: currentAttendance.absentDays,
      previousAttendancePct: previousAttendance.attendancePct,
      recordedDays: currentAttendance.recordedDays,
    },
    leave: {
      approvedDays: Math.round(Number(approvedLeave._sum.duration ?? 0) * 10) / 10,
      previousApprovedDays: Math.round(Number(previousApprovedLeave._sum.duration ?? 0) * 10) / 10,
    },
    performance: {
      latestRating: reviews[0]?.overallRating == null ? null : Number(reviews[0].overallRating),
      previousRating: reviews[1]?.overallRating == null ? null : Number(reviews[1].overallRating),
      goalCompletionPct: goals.completionPct,
      previousGoalCompletionPct: previousGoals.completionPct,
      completedGoals: goals.completed,
      totalGoals: goals.total,
    },
    departmentComparison,
  };
}

export async function getEmployee360(
  employeeId?: string,
): Promise<ActionResult<Workforce360Data>> {
  try {
    const actor = await getWorkforceActor();
    const parsedId = parseTargetEmployeeId(employeeId, actor.profileId);
    if (!parsedId.success) return { ok: false, error: "Invalid employee selection." };
    const targetId = parsedId.data;
    const data = await loadEmployee360(targetId);
    if (!data) return { ok: false, error: "You do not have access to this employee's analytics." };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load Employee 360 analytics.") };
  }
}

export async function generateEmployee360Summary(
  employeeId?: string,
): Promise<ActionResult<{ observations: string[] }>> {
  try {
    const actor = await getWorkforceActor();
    const limited = await enforceRateLimits([
      { key: userRateKey("workforce-ai", actor.userId), ...RATE_LIMITS.copilotUser },
    ]);
    if (limited) return { ok: false, error: limited };
    const parsedId = parseTargetEmployeeId(employeeId, actor.profileId);
    if (!parsedId.success) return { ok: false, error: "Invalid employee selection." };
    const data = await loadEmployee360(parsedId.data);
    if (!data) return { ok: false, error: "You do not have access to this employee's analytics." };
    const observations = await generateWorkforce360Observations({
      role: data.jobTitle,
      period: data.periodLabel,
      attendancePct: data.attendance.attendancePct,
      previousAttendancePct: data.attendance.previousAttendancePct,
      absentDays: data.attendance.absentDays,
      approvedLeaveDays: data.leave.approvedDays,
      previousApprovedLeaveDays: data.leave.previousApprovedDays,
      latestRating: data.performance.latestRating,
      previousRating: data.performance.previousRating,
      goalCompletionPct: data.performance.goalCompletionPct,
      previousGoalCompletionPct: data.performance.previousGoalCompletionPct,
      recordedAttendanceDays: data.attendance.recordedDays,
    });
    return { ok: true, data: { observations } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not generate the AI observations.") };
  }
}

export async function generateEmployeeSkillRecommendations(
  employeeId?: string,
): Promise<ActionResult<{ recommendations: { skillName: string; action: string; reason: string }[] }>> {
  try {
    const actor = await getWorkforceActor();
    const limited = await enforceRateLimits([
      { key: userRateKey("workforce-ai", actor.userId), ...RATE_LIMITS.copilotUser },
    ]);
    if (limited) return { ok: false, error: limited };
    const parsedId = parseTargetEmployeeId(employeeId, actor.profileId);
    if (!parsedId.success) return { ok: false, error: "Invalid employee selection." };
    const targetId = parsedId.data;
    const { profile } = await findVisibleEmployee(targetId);
    if (!profile) return { ok: false, error: "You do not have access to this employee's skills." };
    const [skills, requirements, reviews] = await Promise.all([
      prisma.employeeSkill.findMany({
        where: { employeeId: targetId },
        select: { name: true, proficiency: true },
        orderBy: { name: "asc" },
      }),
      prisma.roleSkillRequirement.findMany({
        where: { organizationId: actor.organizationId },
        select: { skillName: true, targetLevel: true, jobTitle: true },
      }),
      prisma.performanceReview.findMany({
        where: {
          employeeId: targetId,
          cycle: { organizationId: actor.organizationId },
          status: { in: ["submitted", "acknowledged"] },
        },
        select: { goals: { select: { progress: true } } },
        orderBy: { cycle: { periodEnd: "desc" } },
        take: 1,
      }),
    ]);
    const roleRequirements = requirements.filter(
      (requirement) => requirement.jobTitle.trim().toLocaleLowerCase() === profile.jobTitle.trim().toLocaleLowerCase(),
    );
    if (roleRequirements.length === 0) {
      return { ok: false, error: "HR has not configured skill requirements for this job title yet." };
    }
    const gaps = calculateSkillGaps(roleRequirements, skills);
    if (gaps.length === 0) {
      return { ok: true, data: { recommendations: [] } };
    }
    const goalProgress = summarizeGoals(reviews[0]?.goals.map((goal) => goal.progress) ?? []);
    const generated = await generateSkillRecommendations({
      role: profile.jobTitle,
      skills,
      gaps: gaps.map(({ skillName, currentLevel, targetLevel }) => ({
        skillName,
        currentLevel,
        targetLevel,
      })),
      goalCompletionPct: goalProgress.completionPct,
    });
    const allowedGaps = new Set(gaps.map((gap) => gap.skillName.trim().toLocaleLowerCase()));
    const recommendations = generated.filter((recommendation) =>
      allowedGaps.has(recommendation.skillName.trim().toLocaleLowerCase()),
    );
    return { ok: true, data: { recommendations } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not generate learning recommendations.") };
  }
}

function defaultReportRange(template: string, today: string, question: string) {
  const [year, month] = today.split("-").map(Number);
  const questionText = question.toLowerCase();
  if (/last quarter|previous quarter/.test(questionText)) {
    const currentQuarterStartMonth = Math.floor((month - 1) / 3) * 3;
    const previousQuarterEnd = new Date(Date.UTC(year, currentQuarterStartMonth, 0));
    const previousQuarterStart = new Date(Date.UTC(previousQuarterEnd.getUTCFullYear(), previousQuarterEnd.getUTCMonth() - 2, 1));
    return {
      startDate: toDateKey(previousQuarterStart),
      endDate: toDateKey(previousQuarterEnd),
    };
  }
  if (/this quarter|current quarter/.test(questionText)) {
    const startMonth = Math.floor((month - 1) / 3) * 3;
    return { startDate: `${year}-${String(startMonth + 1).padStart(2, "0")}-01`, endDate: today };
  }
  if (/last month|previous month/.test(questionText)) {
    const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));
    const previousMonthStart = new Date(Date.UTC(previousMonthEnd.getUTCFullYear(), previousMonthEnd.getUTCMonth(), 1));
    return { startDate: toDateKey(previousMonthStart), endDate: toDateKey(previousMonthEnd) };
  }
  if (/this month|current month/.test(questionText)) {
    return { startDate: `${year}-${String(month).padStart(2, "0")}-01`, endDate: today };
  }
  if (template === "skill_gap") return { startDate: today, endDate: today };
  if (template === "performance") return { startDate: addDaysToKey(today, -364), endDate: today };
  if (template === "leave") return { startDate: addDaysToKey(today, -89), endDate: today };
  return { startDate: addDaysToKey(today, -29), endDate: today };
}

async function reportEmployeeProfiles(actor: Awaited<ReturnType<typeof getWorkforceActor>>, departmentName: string | null) {
  const visibleIds = visibleEmployeeIds(actor);
  return prisma.employeeProfile.findMany({
    where: {
      organizationId: actor.organizationId,
      role: "employee",
      status: { not: "inactive" },
      ...(visibleIds ? { id: { in: visibleIds } } : {}),
      ...(departmentName
        ? { department: { name: { equals: departmentName, mode: "insensitive" } } }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      employeeId: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  });
}

function buildReportRows(
  grouped: Map<string, ReportGroup>,
  template: string,
) {
  return [...grouped.entries()]
    .map(([label, value]) => {
      if (template === "attendance") {
        const pct = value.total === 0 ? 0 : Math.round((value.completed / value.total) * 100);
        return { label, value: `${pct}%`, detail: `${value.completed} attended of ${value.total} recorded eligible days`, chartValue: pct };
      }
      if (template === "performance") {
        const rating = value.ratingCount === 0 ? "—" : (value.total / value.ratingCount).toFixed(1);
        const goalPct = value.goalTotal === 0 ? 0 : Math.round((value.completed / value.goalTotal) * 100);
        return { label, value: `${rating}/5 average rating`, detail: `${goalPct}% of tracked goals completed`, chartValue: Number(rating) || 0 };
      }
      if (template === "skill_gap") {
        return { label, value: `${value.count} skill gaps`, detail: `${value.employees.size} employees with at least one configured gap`, chartValue: value.count };
      }
      return { label, value: `${value.total.toFixed(1)} approved leave days`, detail: `${value.count} approved requests fully within the selected period across ${value.employees.size} employees`, chartValue: value.total };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function runWorkforceReport(
  question: string,
): Promise<ActionResult<WorkforceReport>> {
  try {
    const actor = await getWorkforceActor();
    if (!actor.isHr && actor.directReportIds.length === 0) {
      return { ok: false, error: "HR reports are available to HR staff and managers with direct reports." };
    }
    const parsedQuestion = z.string().trim().min(4).max(1000).safeParse(question);
    if (!parsedQuestion.success) return { ok: false, error: "Enter a report question between 4 and 1,000 characters." };
    const limited = await enforceRateLimits([
      { key: userRateKey("workforce-report", actor.userId), ...RATE_LIMITS.copilotUser },
    ]);
    if (limited) return { ok: false, error: limited };

    const visibleEmployees = await reportEmployeeProfiles(actor, null);
    const questionLower = parsedQuestion.data.toLocaleLowerCase();
    const mentionsEmployee = visibleEmployees.some((employee) => {
      const name = employee.fullName.trim().toLocaleLowerCase();
      const code = employee.employeeId.trim().toLocaleLowerCase();
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return (
        (name.length >= 2 && new RegExp(`\\b${escapedName}\\b`, "i").test(questionLower)) ||
        (code.length >= 2 && new RegExp(`\\b${escapedCode}\\b`, "i").test(parsedQuestion.data))
      );
    });
    if (mentionsEmployee) {
      return {
        ok: true,
        data: {
          title: "Use Employee 360 for individual views",
          periodLabel: "Not run",
          rows: [],
          summary: "This report generator returns department aggregates only. Select an authorized employee in Employee 360 for an individual summary.",
          aiSummaryAvailable: false,
          limitation: "The employee name or ID was not sent to the report interpreter.",
        },
      };
    }

    const today = kolkataTodayKey();
    const plan = await interpretWorkforceReport(parsedQuestion.data, today);
    if (plan.template === "unsupported") {
      return {
        ok: true,
        data: {
          title: "Report not available",
          periodLabel: "Not run",
          rows: [],
          summary: /turnover|attrition|resign|left the company/i.test(parsedQuestion.data)
            ? "Turnover cannot be calculated reliably because employee termination dates and reasons are not recorded."
            : "This question is outside the currently supported report templates.",
          aiSummaryAvailable: false,
          limitation: "Only validated attendance, leave, performance, and skill-gap templates can query HR data.",
        },
      };
    }

    const defaultRange = defaultReportRange(plan.template, today, parsedQuestion.data);
    const startDate = plan.startDate ?? defaultRange.startDate;
    // "This quarter" ends in the future; report up to today rather than refuse.
    const requestedEnd = plan.endDate ?? defaultRange.endDate;
    const endDate = requestedEnd > today ? today : requestedEnd;
    if (!isValidAnalyticsDateRange(startDate, endDate)) {
      return { ok: false, error: "The report date range is invalid or longer than 366 days." };
    }
    const profiles = await reportEmployeeProfiles(actor, plan.departmentName);
    const employeeIds = profiles.map((profile) => profile.id);
    const departmentByEmployee = new Map(profiles.map((profile) => [profile.id, profile.department.name]));
    const start = dateFromKey(startDate);
    const end = dateFromKey(endDate);
    const grouped = new Map<string, ReportGroup>();
    const groupFor = (employeeId: string) => {
      const department = departmentByEmployee.get(employeeId);
      if (!department) return null;
      const value = grouped.get(department) ?? {
        count: 0,
        total: 0,
        completed: 0,
        goalTotal: 0,
        ratingCount: 0,
        employees: new Set<string>(),
      };
      grouped.set(department, value);
      value.employees.add(employeeId);
      return value;
    };

    if (employeeIds.length > 0 && plan.template === "attendance") {
      const records = await prisma.attendance.groupBy({
        by: ["employeeId", "status"],
        where: { organizationId: actor.organizationId, employeeId: { in: employeeIds }, date: { gte: start, lte: end } },
        _count: { _all: true },
      });
      for (const record of records) {
        const group = groupFor(record.employeeId);
        if (!group) continue;
        const count = record._count._all;
        group.count += count;
        if (record.status === "present" || record.status === "half_day") group.completed += count;
        if (record.status === "present" || record.status === "half_day" || record.status === "absent") {
          group.total += count;
        }
      }
    } else if (employeeIds.length > 0 && plan.template === "leave") {
      const requests = await prisma.leaveRequest.findMany({
        where: {
          organizationId: actor.organizationId,
          employeeId: { in: employeeIds },
          status: "approved",
          startDate: { gte: start, lte: end },
          endDate: { lte: end },
        },
        select: { employeeId: true, duration: true },
      });
      for (const request of requests) {
        const group = groupFor(request.employeeId);
        if (!group) continue;
        group.count += 1;
        group.total += Number(request.duration);
      }
    } else if (employeeIds.length > 0 && plan.template === "performance") {
      const reviews = await prisma.performanceReview.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: { in: ["submitted", "acknowledged"] },
          cycle: {
            organizationId: actor.organizationId,
            periodStart: { lte: end },
            periodEnd: { gte: start },
          },
        },
        select: {
          employeeId: true,
          overallRating: true,
          goals: { select: { progress: true } },
        },
      });
      for (const review of reviews) {
        const group = groupFor(review.employeeId);
        if (!group) continue;
        if (review.overallRating != null) {
          group.ratingCount += 1;
          group.total += Number(review.overallRating);
        }
        group.completed += review.goals.filter((goal) => goal.progress >= 100).length;
        group.goalTotal += review.goals.length;
      }
    } else if (plan.template === "skill_gap") {
      const requirements = await prisma.roleSkillRequirement.findMany({
        where: { organizationId: actor.organizationId },
        select: { jobTitle: true, skillName: true, targetLevel: true },
      });
      const skillProfiles = await prisma.employeeProfile.findMany({
        where: { organizationId: actor.organizationId, id: { in: employeeIds } },
        select: {
          id: true,
          jobTitle: true,
          skills: { select: { name: true, proficiency: true } },
        },
      });
      for (const profile of skillProfiles) {
        const roleRequirements = requirements.filter(
          (requirement) => requirement.jobTitle.trim().toLocaleLowerCase() === profile.jobTitle.trim().toLocaleLowerCase(),
        );
        const gaps = calculateSkillGaps(roleRequirements, profile.skills);
        const group = groupFor(profile.id);
        if (!group) continue;
        // Keep the department row, but count only employees who have a gap.
        if (gaps.length > 0) group.count += gaps.length;
        else group.employees.delete(profile.id);
      }
    }

    const rows = buildReportRows(grouped, plan.template);
    const periodLabel =
      plan.template === "skill_gap"
        ? "Current skill profiles"
        : `${startDate} to ${endDate}`;
    const title = {
      attendance: "Department attendance",
      leave: "Approved leave utilization",
      performance: "Department performance",
      skill_gap: "Department skill gaps",
    }[plan.template];
    let explanation: Awaited<ReturnType<typeof explainWorkforceReport>>;
    try {
      explanation = await explainWorkforceReport({
        rows,
        periodLabel,
      });
    } catch (error) {
      logger.warn("workforce.report.summary_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      explanation = {
        summary: "Report data is ready, but AI narration could not be generated. Review the table below.",
        aiSummaryAvailable: false,
      };
    }
    return {
      ok: true,
      data: {
        title,
        periodLabel,
        rows,
        ...explanation,
        limitation: rows.length === 0 ? "No matching records were found for this scope and period." : null,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not run the HR report.") };
  }
}
