"use server";

import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { mapLeave } from "@/lib/shared/mappers";
import { PIE_COLORS } from "@/lib/shared/mappers";
import { weeklyAttendanceCounts } from "@/lib/actions/people/attendance";
import { hasPermission } from "@/lib/auth/permissions";
import {
  dateFromKey,
  formatDisplayDate,
  formatHours,
  kolkataGreeting,
  kolkataTodayKey,
  toDateKey,
  weekDayKeys,
  workingHours,
} from "@/lib/shared/dates";
import type { ActionResult, DashboardStats, EmployeeDashboardData } from "@/lib/shared/types";

export async function getAdminDashboard(): Promise<ActionResult<DashboardStats>> {
  try {
    const admin = await requirePermission("viewAdminDashboard");
    const today = kolkataTodayKey();
    const todayDate = dateFromKey(today);

    const [
      totalEmployees,
      presentToday,
      leaveToday,
      pendingApprovals,
      weeklyAttendance,
      recentLeaves,
      profiles,
      reviewRows,
    ] = await Promise.all([
      prisma.employeeProfile.count(),
      prisma.attendance.count({
        where: { date: todayDate, status: { in: ["present", "half_day"] } },
      }),
      prisma.leaveRequest.count({
        where: {
          status: "approved",
          startDate: { lte: todayDate },
          endDate: { gte: todayDate },
        },
      }),
      prisma.leaveRequest.count({ where: { status: "pending" } }),
      weeklyAttendanceCounts(),
      prisma.leaveRequest.findMany({
        take: 4,
        orderBy: { createdAt: "desc" },
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
      prisma.employeeProfile.findMany({
        select: { department: { select: { name: true } } },
      }),
      hasPermission(admin.role, "managePerformance")
        ? prisma.performanceReview.findMany({
            select: { overallRating: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const counts = new Map<string, number>();
    for (const profile of profiles) {
      const name = profile.department.name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const distribution = [...counts.entries()].map(([name, value], index) => ({
      name,
      value,
      color: PIE_COLORS[index % PIE_COLORS.length],
      percentage: totalEmployees === 0 ? "0%" : `${Math.round((value / totalEmployees) * 100)}%`,
    }));

    const rated = reviewRows.filter((row) => row.overallRating != null && row.status !== "draft");
    const performance = hasPermission(admin.role, "managePerformance")
      ? {
          avgRating:
            rated.length === 0
              ? null
              : Math.round(
                  (rated.reduce((sum, row) => sum + Number(row.overallRating), 0) / rated.length) * 10,
                ) / 10,
          pendingReviews: reviewRows.filter((row) => row.status === "draft").length,
          submittedReviews: reviewRows.filter((row) => row.status === "submitted").length,
          href: "/admin/hr/performance",
        }
      : null;

    return {
      ok: true,
      data: {
        firstName: admin.fullName.split(" ")[0] ?? "Admin",
        greeting: kolkataGreeting(),
        todayLabel: formatDisplayDate(today),
        totalEmployees,
        presentToday,
        leaveToday,
        pendingApprovals,
        weeklyAttendance,
        recentLeaves: recentLeaves.map((row) => mapLeave(row)),
        distribution,
        activities: recentLeaves.map((row) => ({
          text: `${row.user.profile?.fullName ?? "Employee"} ${row.status} ${row.type.name} leave`,
          time: formatDisplayDate(row.createdAt),
        })),
        performance,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load dashboard.") };
  }
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
