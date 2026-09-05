"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { mapLeave } from "@/lib/shared/mappers";
import { PIE_COLORS } from "@/lib/shared/mappers";
import { hasPermission } from "@/lib/auth/permissions";
import {
  dateFromKey,
  formatDisplayDate,
  formatHours,
  formatRelativeTime,
  kolkataGreeting,
  kolkataTodayKey,
  toDateKey,
  weekDayKeys,
  workingHours,
} from "@/lib/shared/dates";
import type { ActionResult, DashboardStats, EmployeeDashboardData } from "@/lib/shared/types";
import { withTiming } from "@/lib/shared/logger";

type AdminDashboardSnapshot = Omit<DashboardStats, "firstName" | "greeting" | "todayLabel">;

/**
 * Admin-home snapshot is cached ~30s with tags:
 *   employees | attendance | leave | payroll
 * Mutations already call revalidateTag for those (employees.ts, attendance.ts,
 * leave.ts, payruns.ts). Path revalidatePath("/admin") alone does not bust this cache.
 */

async function loadAdminDashboardSnapshot(
  organizationId: string,
  today: string,
  managePerformance: boolean,
): Promise<AdminDashboardSnapshot> {
  const todayDate = dateFromKey(today);
  const orgProfile = { organizationId };
  const weekKeys = weekDayKeys();

  const [
    totalEmployees,
    todayRollup,
    presentTodayCount,
    leaveToday,
    pendingApprovals,
    weeklyGroups,
    recentLeaves,
    deptGroups,
    departments,
    ratingAgg,
    reviewStatusGroups,
  ] = await Promise.all([
    prisma.employeeProfile.count({ where: orgProfile }),
    prisma.attendanceDailyRollup.findUnique({
      where: { organizationId_date: { organizationId, date: todayDate } },
    }),
    prisma.attendance.count({
      where: {
        date: todayDate,
        status: { in: ["present", "half_day"] },
        organizationId,
      },
    }),
    prisma.leaveRequest.count({
      where: {
        status: "approved",
        startDate: { lte: todayDate },
        endDate: { gte: todayDate },
        organizationId,
      },
    }),
    prisma.leaveRequest.count({
      where: { status: "pending", organizationId },
    }),
    prisma.attendance.groupBy({
      by: ["date"],
      where: {
        date: { gte: dateFromKey(weekKeys[0]), lte: dateFromKey(weekKeys[weekKeys.length - 1]) },
        status: { in: ["present", "half_day"] },
        organizationId,
      },
      _count: { _all: true },
    }),
    prisma.leaveRequest.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      where: { organizationId },
      include: {
        type: { select: { code: true, name: true } },
        user: {
          select: {
            email: true,
            profile: { select: { fullName: true, department: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.employeeProfile.groupBy({
      by: ["departmentId"],
      where: orgProfile,
      _count: { _all: true },
    }),
    prisma.department.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    managePerformance
      ? prisma.performanceReview.aggregate({
          where: {
            overallRating: { not: null },
            status: { not: "draft" },
            employee: orgProfile,
          },
          _avg: { overallRating: true },
        })
      : Promise.resolve(null),
    managePerformance
      ? prisma.performanceReview.groupBy({
          by: ["status"],
          where: { employee: orgProfile },
          _count: { _all: true },
        })
      : Promise.resolve([] as { status: string; _count: { _all: number } }[]),
  ]);

  const presentToday = todayRollup
    ? todayRollup.presentCount + todayRollup.halfDayCount
    : presentTodayCount;

  const weekByDate = new Map(
    weeklyGroups.map((row) => [row.date.toISOString().slice(0, 10), row._count._all]),
  );
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyAttendance = weekKeys.map((key, index) => ({
    day: weekLabels[index],
    attendance: weekByDate.get(key) ?? 0,
  }));

  const deptNameById = new Map(departments.map((row) => [row.id, row.name]));
  const distribution = deptGroups
    .map((row) => ({
      name: deptNameById.get(row.departmentId) ?? "Unknown",
      value: row._count._all,
    }))
    .sort((a, b) => b.value - a.value)
    .map((row, index) => ({
      name: row.name,
      value: row.value,
      color: PIE_COLORS[index % PIE_COLORS.length],
      percentage:
        totalEmployees === 0 ? "0%" : `${Math.round((row.value / totalEmployees) * 100)}%`,
    }));

  const activityLeaves = (() => {
    const picked: typeof recentLeaves = [];
    const seenStatus = new Set<string>();
    for (const row of recentLeaves) {
      if (!seenStatus.has(row.status)) {
        picked.push(row);
        seenStatus.add(row.status);
      }
      if (picked.length >= 4) break;
    }
    for (const row of recentLeaves) {
      if (picked.length >= 4) break;
      if (!picked.includes(row)) picked.push(row);
    }
    return picked;
  })();

  const statusCount = new Map(
    reviewStatusGroups.map((row) => [row.status, row._count._all]),
  );
  const avgRaw = ratingAgg?._avg.overallRating;
  const performance = managePerformance
    ? {
        avgRating: avgRaw == null ? null : Math.round(Number(avgRaw) * 10) / 10,
        pendingReviews: statusCount.get("draft") ?? 0,
        submittedReviews: statusCount.get("submitted") ?? 0,
        href: "/admin/hr/performance",
      }
    : null;

  return {
    totalEmployees,
    presentToday,
    leaveToday,
    pendingApprovals,
    weeklyAttendance,
    recentLeaves: activityLeaves.map((row) => mapLeave(row)),
    distribution,
    activities: activityLeaves.map((row) => ({
      text: `${row.user.profile?.fullName ?? "Employee"} ${row.status} ${row.type.name} leave`,
      time: formatRelativeTime(row.createdAt),
    })),
    performance,
  };
}

const getCachedAdminDashboardSnapshot = unstable_cache(
  async (organizationId: string, today: string, managePerformance: boolean) =>
    loadAdminDashboardSnapshot(organizationId, today, managePerformance),
  ["admin-dashboard-snapshot"],
  { revalidate: 30, tags: ["employees", "attendance", "leave", "payroll"] },
);

export async function getAdminDashboard(): Promise<ActionResult<DashboardStats>> {
  return withTiming("timing.admin_dashboard", async () => {
  try {
    const admin = await requirePermission("viewAdminDashboard");
    const today = kolkataTodayKey();
    const managePerformance = hasPermission(admin.role, "managePerformance");

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: admin.id },
      select: { organizationId: true },
    });
    if (!profile) {
      return { ok: false, error: "No organization found for this user." };
    }

    const snapshot = await getCachedAdminDashboardSnapshot(
      profile.organizationId,
      today,
      managePerformance,
    );

    return {
      ok: true,
      data: {
        firstName: admin.fullName.split(" ")[0] ?? "Admin",
        greeting: kolkataGreeting(),
        todayLabel: formatDisplayDate(today),
        ...snapshot,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load dashboard.") };
  }
  });
}

export async function getEmployeeDashboard(): Promise<ActionResult<EmployeeDashboardData>> {
  try {
    const user = await requireUser();
    const today = kolkataTodayKey();
    const keys = weekDayKeys();
    const [todayRow, weekRows, profile, nextLeave, latestReview] = await Promise.all([
      prisma.attendance.findUnique({
        where: { userId_date: { userId: user.id, date: dateFromKey(today) } },
        select: { checkIn: true, checkOut: true },
      }),
      prisma.attendance.findMany({
        where: {
          userId: user.id,
          date: { gte: dateFromKey(keys[0]), lte: dateFromKey(keys[5]) },
        },
        select: { date: true, checkIn: true, checkOut: true, workedHours: true },
      }),
      prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        select: { paidLeaveBalance: true },
      }),
      prisma.leaveRequest.findFirst({
        where: {
          userId: user.id,
          status: { in: ["approved", "pending"] },
          endDate: { gte: dateFromKey(today) },
        },
        orderBy: { startDate: "asc" },
        include: { type: { select: { name: true } } },
      }),
      prisma.performanceReview.findFirst({
        where: {
          employee: { userId: user.id },
          status: { in: ["submitted", "acknowledged"] },
        },
        orderBy: { submittedAt: "desc" },
        select: { overallRating: true },
      }),
    ]);

    const byDate = new Map(weekRows.map((row) => [toDateKey(row.date), row]));
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const weeklyHours = keys.slice(0, 5).map((key, index) => {
      const row = byDate.get(key);
      const hours =
        row?.workedHours != null
          ? Number(row.workedHours)
          : workingHours(row?.checkIn ?? null, row?.checkOut ?? null);
      return {
        day: labels[index],
        hours: Number(hours.toFixed(1)),
      };
    });

    const upcomingLabel = nextLeave
      ? `${nextLeave.status === "pending" ? "Pending" : "Approved"} ${nextLeave.type.name} · ${formatDisplayDate(nextLeave.startDate)}`
      : "No upcoming leave";

    return {
      ok: true,
      data: {
        firstName: user.fullName.split(" ")[0] ?? "there",
        greeting: kolkataGreeting(),
        todayLabel: formatDisplayDate(today),
        isClockedIn: Boolean(todayRow?.checkIn && !todayRow.checkOut),
        checkInLabel: todayRow?.checkIn
          ? new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }).format(todayRow.checkIn)
          : "",
        workedHours: formatHours(
          todayRow?.checkIn
            ? workingHours(todayRow.checkIn, todayRow.checkOut ?? new Date())
            : 0,
        ),
        remainingLeave: profile?.paidLeaveBalance ?? 0,
        upcomingLabel,
        latestRating: latestReview?.overallRating == null ? null : Number(latestReview.overallRating),
        weeklyHours,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load dashboard.") };
  }
}
