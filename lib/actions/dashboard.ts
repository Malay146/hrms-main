"use server";

import { prisma } from "@/lib/db";
import { actionErrorMessage, requireRole } from "@/lib/session";
import { mapLeave } from "@/lib/mappers";
import { PIE_COLORS } from "@/lib/mappers";
import { weeklyAttendanceCounts } from "@/lib/actions/attendance";
import {
  dateFromKey,
  formatDisplayDate,
  formatHours,
  kolkataTodayKey,
  weekDayKeys,
  workingHours,
} from "@/lib/dates";
import type { ActionResult, DashboardStats, EmployeeDashboardData } from "@/lib/types";

export async function getAdminDashboard(): Promise<ActionResult<DashboardStats>> {
  try {
    const admin = await requireRole("admin");
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
    ] = await Promise.all([
      prisma.employeeProfile.count({ where: { role: "employee" } }),
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
          user: {
            select: {
              email: true,
              profile: { select: { fullName: true, department: true } },
            },
          },
        },
      }),
      prisma.employeeProfile.findMany({
        where: { role: "employee" },
        select: { department: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const profile of profiles) {
      counts.set(profile.department, (counts.get(profile.department) ?? 0) + 1);
    }
    const distribution = [...counts.entries()].map(([name, value], index) => ({
      name,
      value,
      color: PIE_COLORS[index % PIE_COLORS.length],
      percentage: totalEmployees === 0 ? "0%" : `${Math.round((value / totalEmployees) * 100)}%`,
    }));

    return {
      ok: true,
      data: {
        firstName: admin.fullName.split(" ")[0] ?? "Admin",
        todayLabel: formatDisplayDate(today),
        totalEmployees,
        presentToday,
        leaveToday,
        pendingApprovals,
        weeklyAttendance,
        recentLeaves: recentLeaves.map((row) => mapLeave(row)),
        distribution,
        activities: recentLeaves.map((row) => ({
          text: `${row.user.profile?.fullName ?? "Employee"} ${row.status} ${row.type} leave`,
          time: formatDisplayDate(row.createdAt),
        })),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load dashboard.") };
  }
}

export async function getEmployeeDashboard(): Promise<ActionResult<EmployeeDashboardData>> {
  try {
    const user = await requireRole("employee");
    const today = kolkataTodayKey();
    const keys = weekDayKeys();
    const [todayRow, weekRows, profile] = await Promise.all([
      prisma.attendance.findUnique({
        where: { userId_date: { userId: user.id, date: dateFromKey(today) } },
      }),
      prisma.attendance.findMany({
        where: {
          userId: user.id,
          date: { gte: dateFromKey(keys[0]), lte: dateFromKey(keys[5]) },
        },
      }),
      prisma.employeeProfile.findUnique({
        where: { userId: user.id },
        select: { paidLeaveBalance: true },
      }),
    ]);

    const byDate = new Map(weekRows.map((row) => [row.date.toISOString().slice(0, 10), row]));
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const weeklyHours = keys.slice(0, 5).map((key, index) => {
      const row = byDate.get(key);
      return {
        day: labels[index],
        hours: Number(workingHours(row?.checkIn ?? null, row?.checkOut ?? null).toFixed(1)),
      };
    });

    return {
      ok: true,
      data: {
        firstName: user.fullName.split(" ")[0] ?? "there",
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
        workedHours: formatHours(workingHours(todayRow?.checkIn ?? null, todayRow?.checkOut ?? new Date())),
        remainingLeave: profile?.paidLeaveBalance ?? 0,
        weeklyHours,
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load dashboard.") };
  }
}
