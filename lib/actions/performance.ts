"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { createNotifications } from "@/lib/shared/notify";
import { dateFromKey, formatDisplayDate, toDateKey } from "@/lib/shared/dates";
import { PIE_COLORS } from "@/lib/shared/mappers";
import { clampPage, clampPageSize, pageSkip, totalPagesFor } from "@/lib/shared/pagination";
import type { ActionResult } from "@/lib/shared/types";
import {
  acknowledgeReviewSchema,
  createPerformanceReviewSchema,
  firstZodError,
  performanceCycleSchema,
  performanceIdSchema,
  savePerformanceReviewSchema,
  updateMyGoalSchema,
} from "@/lib/shared/validations";
import type {
  PerformanceBoard,
  PerformanceCycleItem,
  PerformanceGoalItem,
  PerformanceGoalStatus,
  PerformanceReviewItem,
  PerformanceReviewStatus,
} from "@/lib/performance/types";

function revalidatePerformance() {
  revalidatePath("/admin/hr/performance");
  revalidatePath("/employee/performance");
  revalidatePath("/admin");
  revalidatePath("/employee");
  revalidatePath("/admin/analytics");
}

function goalStatusFromProgress(progress: number, fallback?: PerformanceGoalStatus): PerformanceGoalStatus {
  if (progress >= 100) return "completed";
  if (progress > 0) return "in_progress";
  return fallback ?? "not_started";
}

function mapGoal(row: {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: PerformanceGoalStatus;
}): PerformanceGoalItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    progress: row.progress,
    status: row.status,
  };
}

function mapReview(row: {
  id: string;
  cycleId: string;
  status: PerformanceReviewStatus;
  overallRating: unknown;
  summary: string;
  employeeComments: string;
  submittedAt: Date | null;
  acknowledgedAt: Date | null;
  cycle: { name: string; periodStart: Date; periodEnd: Date };
  employee: {
    id: string;
    userId: string;
    fullName: string;
    employeeId: string;
    jobTitle: string;
    department: { name: string };
  };
  reviewer: { fullName: string } | null;
  goals: { id: string; title: string; description: string; progress: number; status: PerformanceGoalStatus }[];
}): PerformanceReviewItem {
  const goals = row.goals.map(mapGoal);
  return {
    id: row.id,
    cycleId: row.cycleId,
    cycleName: row.cycle.name,
    periodLabel: `${formatDisplayDate(row.cycle.periodStart)} – ${formatDisplayDate(row.cycle.periodEnd)}`,
    employeeId: row.employee.id,
    employeeUserId: row.employee.userId,
    employeeName: row.employee.fullName,
    employeeCode: row.employee.employeeId,
    department: row.employee.department.name,
    jobTitle: row.employee.jobTitle,
    reviewerName: row.reviewer?.fullName ?? null,
    status: row.status,
    overallRating: row.overallRating == null ? null : Number(row.overallRating),
    summary: row.summary,
    employeeComments: row.employeeComments,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    goals,
    goalsOnTrack: goals.filter((goal) => goal.progress >= 50).length,
  };
}

const reviewInclude = {
  cycle: { select: { name: true, periodStart: true, periodEnd: true, status: true } },
  employee: {
    select: {
      id: true,
      userId: true,
      fullName: true,
      employeeId: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  },
  reviewer: { select: { fullName: true } },
  goals: { orderBy: { createdAt: "asc" as const } },
};

async function staffOrgId(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { id: true, organizationId: true },
  });
  if (!profile) throw new Error("No organization on this account.");
  return profile;
}

export async function getPerformanceBoard(input?: {
  page?: number;
  pageSize?: number;
  search?: string;
  cycleId?: string;
  status?: string;
  employeeSearch?: string;
}): Promise<ActionResult<PerformanceBoard>> {
  try {
    const user = await requirePermission("managePerformance");
    const { organizationId } = await staffOrgId(user.id);
    const page = clampPage(input?.page);
    const pageSize = clampPageSize(input?.pageSize);
    const search = input?.search?.trim() ?? "";
    const employeeSearch = input?.employeeSearch?.trim() ?? "";
    const cycleId = input?.cycleId?.trim() || undefined;
    const statusRaw = input?.status?.trim() || "";
    const status: PerformanceReviewStatus | undefined =
      statusRaw === "draft" || statusRaw === "submitted" || statusRaw === "acknowledged"
        ? statusRaw
        : undefined;

    const reviewScope: Prisma.PerformanceReviewWhereInput = {
      cycle: {
        organizationId,
        ...(cycleId ? { id: cycleId } : {}),
      },
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { employee: { fullName: { contains: search, mode: "insensitive" as const } } },
              { employee: { employeeId: { contains: search, mode: "insensitive" as const } } },
              { employee: { department: { name: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const statsScope: Prisma.PerformanceReviewWhereInput = {
      cycle: {
        organizationId,
        ...(cycleId ? { id: cycleId } : {}),
      },
    };

    const employeeWhere = {
      organizationId,
      role: "employee" as const,
      status: { not: "inactive" as const },
      ...(employeeSearch
        ? {
            OR: [
              { fullName: { contains: employeeSearch, mode: "insensitive" as const } },
              { employeeId: { contains: employeeSearch, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [
      cycles,
      total,
      reviews,
      employees,
      statusGroups,
      ratingAgg,
      ratingRows,
      goalCount,
      goalsOnTrack,
    ] = await Promise.all([
      prisma.performanceCycle.findMany({
        where: { organizationId },
        include: { _count: { select: { reviews: true } } },
        orderBy: { periodStart: "desc" },
        take: 50,
      }),
      prisma.performanceReview.count({ where: reviewScope }),
      prisma.performanceReview.findMany({
        where: reviewScope,
        include: reviewInclude,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip: pageSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.employeeProfile.findMany({
        where: employeeWhere,
        select: {
          id: true,
          fullName: true,
          employeeId: true,
          department: { select: { name: true } },
        },
        orderBy: { fullName: "asc" },
        take: 40,
      }),
      prisma.performanceReview.groupBy({
        by: ["status"],
        where: statsScope,
        _count: { _all: true },
      }),
      prisma.performanceReview.aggregate({
        where: { ...statsScope, overallRating: { not: null } },
        _avg: { overallRating: true },
      }),
      prisma.performanceReview.findMany({
        where: { ...statsScope, overallRating: { not: null } },
        select: { overallRating: true },
      }),
      prisma.performanceGoal.count({
        where: { review: statsScope },
      }),
      prisma.performanceGoal.count({
        where: { progress: { gte: 50 }, review: statsScope },
      }),
    ]);

    const statusCount = Object.fromEntries(
      statusGroups.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<PerformanceReviewStatus, number>>;

    const avgRaw = ratingAgg._avg.overallRating;
    const avgRating =
      avgRaw == null ? null : Math.round(Number(avgRaw) * 10) / 10;

    const buckets = [0, 0, 0, 0, 0];
    for (const row of ratingRows) {
      const slot = Math.min(4, Math.max(0, Math.round(Number(row.overallRating ?? 1)) - 1));
      buckets[slot] += 1;
    }
    const ratedCount = ratingRows.length;
    const ratingDistribution = buckets.map((value, index) => ({
      name: `${index + 1} star`,
      value,
      color: PIE_COLORS[index % PIE_COLORS.length],
      percentage: ratedCount === 0 ? "0%" : `${Math.round((value / ratedCount) * 100)}%`,
    }));

    return {
      ok: true,
      data: {
        cycles: cycles.map((cycle): PerformanceCycleItem => ({
          id: cycle.id,
          name: cycle.name,
          periodStart: toDateKey(cycle.periodStart),
          periodEnd: toDateKey(cycle.periodEnd),
          periodLabel: `${formatDisplayDate(cycle.periodStart)} – ${formatDisplayDate(cycle.periodEnd)}`,
          status: cycle.status,
          reviewCount: cycle._count.reviews,
        })),
        reviews: reviews.map(mapReview),
        employees: employees.map((row) => ({
          id: row.id,
          name: row.fullName,
          employeeId: row.employeeId,
          department: row.department.name,
        })),
        page,
        pageSize,
        total,
        totalPages: totalPagesFor(total, pageSize),
        stats: {
          avgRating,
          pendingReviews: statusCount.draft ?? 0,
          submittedReviews: statusCount.submitted ?? 0,
          acknowledgedReviews: statusCount.acknowledged ?? 0,
          goalsOnTrack,
          goalCount,
        },
        ratingDistribution,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load performance.") };
  }
}

export async function upsertPerformanceCycleAction(input: {
  id?: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  seedEmployees?: boolean;
}): Promise<ActionResult<PerformanceCycleItem>> {
  try {
    const user = await requirePermission("managePerformance");
    const parsed = performanceCycleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    if (parsed.data.periodEnd < parsed.data.periodStart) {
      return { ok: false, error: "Cycle end date must be on or after the start date." };
    }
    const { id: profileId, organizationId } = await staffOrgId(user.id);

    if (parsed.data.id) {
      const existing = await prisma.performanceCycle.findFirst({
        where: { id: parsed.data.id, organizationId },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Cycle not found." };
    }

    const saved = parsed.data.id
      ? await prisma.performanceCycle.update({
          where: { id: parsed.data.id },
          data: {
            name: parsed.data.name,
            periodStart: dateFromKey(parsed.data.periodStart),
            periodEnd: dateFromKey(parsed.data.periodEnd),
          },
          include: { _count: { select: { reviews: true } } },
        })
      : await prisma.performanceCycle.create({
          data: {
            organizationId,
            name: parsed.data.name,
            periodStart: dateFromKey(parsed.data.periodStart),
            periodEnd: dateFromKey(parsed.data.periodEnd),
          },
          include: { _count: { select: { reviews: true } } },
        });

    if (saved.organizationId !== organizationId) {
      return { ok: false, error: "Cycle not found." };
    }

    if (parsed.data.seedEmployees && saved.status === "open") {
      const employees = await prisma.employeeProfile.findMany({
        where: { organizationId, role: "employee", status: { not: "inactive" } },
        select: { id: true },
      });
      await prisma.performanceReview.createMany({
        data: employees.map((employee) => ({
          cycleId: saved.id,
          employeeId: employee.id,
          reviewerId: profileId,
        })),
        skipDuplicates: true,
      });
    }

    const count = await prisma.performanceReview.count({ where: { cycleId: saved.id } });
    revalidatePerformance();
    return {
      ok: true,
      data: {
        id: saved.id,
        name: saved.name,
        periodStart: toDateKey(saved.periodStart),
        periodEnd: toDateKey(saved.periodEnd),
        periodLabel: `${formatDisplayDate(saved.periodStart)} – ${formatDisplayDate(saved.periodEnd)}`,
        status: saved.status,
        reviewCount: count,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save the review cycle.") };
  }
}

export async function closePerformanceCycleAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("managePerformance");
    const parsed = performanceIdSchema.safeParse({ id });
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const { organizationId } = await staffOrgId(user.id);
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: parsed.data.id, organizationId },
      select: { id: true },
    });
    if (!cycle) return { ok: false, error: "Cycle not found." };
    await prisma.performanceCycle.update({
      where: { id: cycle.id },
      data: { status: "closed" },
    });
    revalidatePerformance();
    return { ok: true, data: { id: cycle.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not close the cycle.") };
  }
}

export async function createPerformanceReviewAction(input: {
  cycleId: string;
  employeeId: string;
  goals?: { title: string; description?: string }[];
}): Promise<ActionResult<PerformanceReviewItem>> {
  try {
    const user = await requirePermission("managePerformance");
    const parsed = createPerformanceReviewSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const { id: reviewerId, organizationId } = await staffOrgId(user.id);
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: parsed.data.cycleId, organizationId },
    });
    if (!cycle) return { ok: false, error: "Cycle not found." };
    if (cycle.status !== "open") return { ok: false, error: "This cycle is closed." };
    const employee = await prisma.employeeProfile.findFirst({
      where: { id: parsed.data.employeeId, organizationId },
      select: { id: true },
    });
    if (!employee) return { ok: false, error: "Employee not found." };

    const created = await prisma.performanceReview.create({
      data: {
        cycleId: cycle.id,
        employeeId: employee.id,
        reviewerId,
        goals: {
          create: parsed.data.goals.map((goal) => ({
            title: goal.title,
            description: goal.description ?? "",
            progress: goal.progress ?? 0,
            status: goalStatusFromProgress(goal.progress ?? 0, goal.status),
          })),
        },
      },
      include: reviewInclude,
    });
    revalidatePerformance();
    return { ok: true, data: mapReview(created) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "This employee already has a review in that cycle." };
    }
    return { ok: false, error: actionErrorMessage(error, "Could not create the review.") };
  }
}

export async function savePerformanceReviewAction(input: {
  reviewId: string;
  overallRating: number;
  summary?: string;
  goals: { id?: string; title: string; description?: string; progress?: number; status?: PerformanceGoalStatus }[];
}): Promise<ActionResult<PerformanceReviewItem>> {
  try {
    const user = await requirePermission("managePerformance");
    const parsed = savePerformanceReviewSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const { id: reviewerId, organizationId } = await staffOrgId(user.id);
    const existing = await prisma.performanceReview.findFirst({
      where: { id: parsed.data.reviewId, cycle: { organizationId } },
      include: { cycle: { select: { status: true } } },
    });
    if (!existing) return { ok: false, error: "Review not found." };
    if (existing.cycle.status !== "open") return { ok: false, error: "This cycle is closed." };
    if (existing.status === "acknowledged") {
      return { ok: false, error: "Acknowledged reviews cannot be edited." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.performanceReview.update({
        where: { id: existing.id },
        data: {
          overallRating: parsed.data.overallRating,
          summary: parsed.data.summary,
          reviewerId,
        },
      });
      await tx.performanceGoal.deleteMany({ where: { reviewId: existing.id } });
      if (parsed.data.goals.length > 0) {
        await tx.performanceGoal.createMany({
          data: parsed.data.goals.map((goal) => ({
            reviewId: existing.id,
            title: goal.title,
            description: goal.description ?? "",
            progress: goal.progress ?? 0,
            status: goalStatusFromProgress(goal.progress ?? 0, goal.status),
          })),
        });
      }
    });

    const saved = await prisma.performanceReview.findUniqueOrThrow({
      where: { id: existing.id },
      include: reviewInclude,
    });
    revalidatePerformance();
    return { ok: true, data: mapReview(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save the review.") };
  }
}

export async function submitPerformanceReviewAction(id: string): Promise<ActionResult<PerformanceReviewItem>> {
  try {
    const user = await requirePermission("managePerformance");
    const parsed = performanceIdSchema.safeParse({ id });
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const { organizationId } = await staffOrgId(user.id);
    const existing = await prisma.performanceReview.findFirst({
      where: { id: parsed.data.id, cycle: { organizationId } },
      include: reviewInclude,
    });
    if (!existing) return { ok: false, error: "Review not found." };
    if (existing.cycle.status !== "open") return { ok: false, error: "This cycle is closed." };
    if (existing.overallRating == null) {
      return { ok: false, error: "Add an overall rating before submitting." };
    }
    if (existing.goals.length === 0) {
      return { ok: false, error: "Add at least one goal before submitting." };
    }

    const saved = await prisma.performanceReview.update({
      where: { id: existing.id },
      data: { status: "submitted", submittedAt: new Date() },
      include: reviewInclude,
    });
    await createNotifications({
      userIds: [existing.employee.userId],
      title: "Performance review ready",
      body: `${saved.cycle.name} is ready for you to review and acknowledge.`,
      category: "performance",
      href: "/employee/performance",
    });
    revalidatePerformance();
    return { ok: true, data: mapReview(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not submit the review.") };
  }
}

export async function deletePerformanceReviewAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("managePerformance");
    const parsed = performanceIdSchema.safeParse({ id });
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const { organizationId } = await staffOrgId(user.id);
    const existing = await prisma.performanceReview.findFirst({
      where: { id: parsed.data.id, cycle: { organizationId } },
      select: { id: true, status: true },
    });
    if (!existing) return { ok: false, error: "Review not found." };
    if (existing.status !== "draft") {
      return { ok: false, error: "Only draft reviews can be deleted." };
    }
    await prisma.performanceReview.delete({ where: { id: existing.id } });
    revalidatePerformance();
    return { ok: true, data: { id: existing.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete the review.") };
  }
}

export async function listMyPerformance(): Promise<ActionResult<PerformanceReviewItem[]>> {
  try {
    const user = await requireUser();
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) return { ok: true, data: [] };
    const rows = await prisma.performanceReview.findMany({
      where: {
        employeeId: profile.id,
        status: { in: ["submitted", "acknowledged"] },
      },
      include: reviewInclude,
      orderBy: { updatedAt: "desc" },
    });
    return { ok: true, data: rows.map(mapReview) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load your reviews.") };
  }
}

export async function updateMyGoalProgressAction(input: {
  goalId: string;
  progress: number;
}): Promise<ActionResult<PerformanceGoalItem>> {
  try {
    const user = await requireUser();
    const parsed = updateMyGoalSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const goal = await prisma.performanceGoal.findFirst({
      where: {
        id: parsed.data.goalId,
        review: { employee: { userId: user.id } },
      },
      include: { review: { select: { status: true } } },
    });
    if (!goal) return { ok: false, error: "Goal not found." };
    if (goal.review.status === "acknowledged") {
      return { ok: false, error: "This review is already acknowledged." };
    }
    const saved = await prisma.performanceGoal.update({
      where: { id: goal.id },
      data: {
        progress: parsed.data.progress,
        status: goalStatusFromProgress(parsed.data.progress),
      },
    });
    revalidatePerformance();
    return { ok: true, data: mapGoal(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not update goal progress.") };
  }
}

export async function acknowledgePerformanceReviewAction(input: {
  reviewId: string;
  employeeComments?: string;
}): Promise<ActionResult<PerformanceReviewItem>> {
  try {
    const user = await requireUser();
    const parsed = acknowledgeReviewSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const existing = await prisma.performanceReview.findFirst({
      where: { id: parsed.data.reviewId, employee: { userId: user.id } },
      include: reviewInclude,
    });
    if (!existing) return { ok: false, error: "Review not found." };
    if (existing.status !== "submitted") {
      return { ok: false, error: "Only submitted reviews can be acknowledged." };
    }
    const saved = await prisma.performanceReview.update({
      where: { id: existing.id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        employeeComments: parsed.data.employeeComments,
      },
      include: reviewInclude,
    });
    if (existing.reviewerId) {
      const reviewer = await prisma.employeeProfile.findUnique({
        where: { id: existing.reviewerId },
        select: { userId: true },
      });
      if (reviewer) {
        await createNotifications({
          userIds: [reviewer.userId],
          title: "Review acknowledged",
          body: `${existing.employee.fullName} acknowledged ${existing.cycle.name}.`,
          category: "performance",
          href: "/admin/hr/performance",
        });
      }
    }
    revalidatePerformance();
    return { ok: true, data: mapReview(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not acknowledge the review.") };
  }
}
