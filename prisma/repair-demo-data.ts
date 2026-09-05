/**
 * Repair inconsistent demo data without a full reseed.
 * Run: npx tsx prisma/repair-demo-data.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import {
  dateFromKey,
  eachDateKey,
  inclusiveDayCount,
  kolkataTodayKey,
  toDateKey,
  weekDayKeys,
} from "../lib/shared/dates";

const PAID_ALLOCATION = 20;
const VALIDITY_YEAR = 2026;

async function fixInvertedLeaveDates() {
  const leaves = await prisma.leaveRequest.findMany({
    select: { id: true, startDate: true, endDate: true, duration: true },
  });
  let fixed = 0;
  let durations = 0;
  for (const row of leaves) {
    let start = toDateKey(row.startDate);
    let end = toDateKey(row.endDate);
    if (end < start) {
      await prisma.leaveRequest.update({
        where: { id: row.id },
        data: {
          startDate: dateFromKey(end),
          endDate: dateFromKey(start),
          duration: inclusiveDayCount(end, start),
        },
      });
      fixed += 1;
      continue;
    }
    const duration = inclusiveDayCount(start, end);
    if (Number(row.duration) !== duration) {
      await prisma.leaveRequest.update({
        where: { id: row.id },
        data: { duration },
      });
      durations += 1;
    }
  }
  console.log(`Fixed inverted leave ranges: ${fixed}; duration corrections: ${durations}`);
}

async function ensureAllocationsAndBalances(organizationId: string) {
  const paidType = await prisma.timeOffType.findUnique({
    where: { organizationId_code: { organizationId, code: "paid" } },
  });
  const compType = await prisma.timeOffType.findUnique({
    where: { organizationId_code: { organizationId, code: "comp_off" } },
  });
  if (!paidType) throw new Error("Paid time-off type missing");

  const profiles = await prisma.employeeProfile.findMany({
    where: { organizationId, status: { not: "inactive" } },
    select: { id: true, userId: true },
  });

  const approvedPaid = await prisma.leaveRequest.findMany({
    where: {
      status: "approved",
      typeId: paidType.id,
      user: { profile: { organizationId } },
    },
    select: { id: true, userId: true, duration: true, allocationId: true },
  });
  const takenByUser = new Map<string, number>();
  for (const row of approvedPaid) {
    const days = Math.max(0, Number(row.duration));
    takenByUser.set(row.userId, (takenByUser.get(row.userId) ?? 0) + days);
  }

  const allocationByEmployee = new Map<string, string>();
  let created = 0;
  for (const profile of profiles) {
    let allocation = await prisma.timeOffAllocation.findFirst({
      where: {
        employeeId: profile.id,
        typeId: paidType.id,
        validityYear: VALIDITY_YEAR,
      },
    });
    const taken = Math.min(PAID_ALLOCATION, takenByUser.get(profile.userId) ?? 0);
    if (!allocation) {
      allocation = await prisma.timeOffAllocation.create({
        data: {
          employeeId: profile.id,
          typeId: paidType.id,
          allocated: PAID_ALLOCATION,
          taken,
          validityYear: VALIDITY_YEAR,
          status: "approved",
          description: "Annual paid leave",
        },
      });
      created += 1;
    } else {
      allocation = await prisma.timeOffAllocation.update({
        where: { id: allocation.id },
        data: {
          allocated: PAID_ALLOCATION,
          taken,
          status: "approved",
        },
      });
    }
    allocationByEmployee.set(profile.id, allocation.id);

    if (compType) {
      const existingComp = await prisma.timeOffAllocation.findFirst({
        where: {
          employeeId: profile.id,
          typeId: compType.id,
          validityYear: VALIDITY_YEAR,
        },
      });
      if (!existingComp) {
        await prisma.timeOffAllocation.create({
          data: {
            employeeId: profile.id,
            typeId: compType.id,
            allocated: 5,
            taken: 0,
            validityYear: VALIDITY_YEAR,
            status: "approved",
            description: "Comp-off bank",
          },
        });
      }
    }

    await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: { paidLeaveBalance: Math.max(0, PAID_ALLOCATION - taken) },
    });
  }

  const profileByUser = new Map(profiles.map((p) => [p.userId, p.id]));
  let linked = 0;
  for (const row of approvedPaid) {
    if (row.allocationId) continue;
    const employeeId = profileByUser.get(row.userId);
    const allocationId = employeeId ? allocationByEmployee.get(employeeId) : null;
    if (!allocationId) continue;
    await prisma.leaveRequest.update({
      where: { id: row.id },
      data: { allocationId },
    });
    linked += 1;
  }

  // Pending paid leaves also need an allocation to approve later
  const pendingPaid = await prisma.leaveRequest.findMany({
    where: {
      status: "pending",
      typeId: paidType.id,
      allocationId: null,
      user: { profile: { organizationId } },
    },
    select: { id: true, userId: true },
  });
  for (const row of pendingPaid) {
    const employeeId = profileByUser.get(row.userId);
    const allocationId = employeeId ? allocationByEmployee.get(employeeId) : null;
    if (!allocationId) continue;
    await prisma.leaveRequest.update({
      where: { id: row.id },
      data: { allocationId },
    });
    linked += 1;
  }

  console.log(`Allocations created/updated for ${profiles.length} staff (new: ${created}), linked leaves: ${linked}`);
}

async function ensureRunningContracts(organizationId: string) {
  const structure = await prisma.salaryStructure.findFirst({
    where: { organizationId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const missing = await prisma.employeeProfile.findMany({
    where: {
      organizationId,
      status: { in: ["active", "on_leave"] },
      NOT: { contracts: { some: { status: "running" } } },
    },
    select: {
      id: true,
      departmentId: true,
      scheduleId: true,
      jobTitle: true,
      wage: true,
      joinDate: true,
      employeeType: true,
      employeeId: true,
    },
  });

  let seq =
    (await prisma.contract.count({
      where: { employee: { organizationId } },
    })) + 1;

  for (const profile of missing) {
    await prisma.contract.create({
      data: {
        code: `CON/2026/R${String(seq).padStart(4, "0")}`,
        employeeId: profile.id,
        departmentId: profile.departmentId,
        scheduleId: profile.scheduleId,
        salaryStructureId: structure?.id ?? null,
        jobTitle: profile.jobTitle,
        wage: profile.wage ?? 40000,
        startDate: profile.joinDate ?? dateFromKey(kolkataTodayKey()),
        endDate: null,
        status: "running",
        notes: "Repaired running contract",
      },
    });
    seq += 1;
  }
  console.log(`Running contracts added: ${missing.length}`);
}

async function alignAttendanceWithLeave(organizationId: string) {
  const weekKeys = weekDayKeys();
  const approved = await prisma.leaveRequest.findMany({
    where: {
      status: "approved",
      user: { profile: { organizationId } },
      startDate: { lte: dateFromKey(weekKeys[weekKeys.length - 1]!) },
      endDate: { gte: dateFromKey(weekKeys[0]!) },
    },
    select: { userId: true, startDate: true, endDate: true },
  });

  const leaveOnDay = new Map<string, Set<string>>();
  for (const key of weekKeys) leaveOnDay.set(key, new Set());
  for (const leave of approved) {
    const start = toDateKey(leave.startDate);
    const end = toDateKey(leave.endDate);
    for (const key of eachDateKey(start, end)) {
      leaveOnDay.get(key)?.add(leave.userId);
    }
  }

  let upserted = 0;
  for (const key of weekKeys) {
    for (const userId of leaveOnDay.get(key) ?? []) {
      await prisma.attendance.upsert({
        where: { userId_date: { userId, date: dateFromKey(key) } },
        update: {
          status: "leave",
          checkIn: null,
          checkOut: null,
          workedHours: 0,
        },
        create: {
          userId,
          date: dateFromKey(key),
          status: "leave",
          checkIn: null,
          checkOut: null,
          workedHours: 0,
        },
      });
      upserted += 1;
    }
  }

  // Attendance marked leave without a covering approved leave → absent
  const leaveRows = await prisma.attendance.findMany({
    where: {
      status: "leave",
      date: { gte: dateFromKey(weekKeys[0]!), lte: dateFromKey(weekKeys[weekKeys.length - 1]!) },
      user: { profile: { organizationId } },
    },
    select: { id: true, userId: true, date: true },
  });
  let demoted = 0;
  for (const row of leaveRows) {
    const key = toDateKey(row.date);
    if (leaveOnDay.get(key)?.has(row.userId)) continue;
    await prisma.attendance.update({
      where: { id: row.id },
      data: { status: "absent", checkIn: null, checkOut: null, workedHours: 0 },
    });
    demoted += 1;
  }

  console.log(`Attendance leave upserts: ${upserted}, demoted orphan leave rows: ${demoted}`);
}

async function seedPerformanceSample(organizationId: string) {
  const cycle = await prisma.performanceCycle.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  if (!cycle) {
    console.log("No performance cycle — skip reviews");
    return;
  }

  const existing = await prisma.performanceReview.count({ where: { cycleId: cycle.id } });
  if (existing > 0) {
    console.log(`Performance reviews already present: ${existing}`);
    return;
  }

  const hr = await prisma.employeeProfile.findFirst({
    where: { organizationId, role: { in: ["hr_manager", "admin"] } },
    select: { id: true },
  });
  const employees = await prisma.employeeProfile.findMany({
    where: { organizationId, status: "active", role: "employee" },
    select: { id: true, fullName: true },
    orderBy: { employeeId: "asc" },
    take: 12,
  });

  for (const [index, employee] of employees.entries()) {
    const status = index % 3 === 0 ? "submitted" : index % 3 === 1 ? "acknowledged" : "draft";
    await prisma.performanceReview.create({
      data: {
        cycleId: cycle.id,
        employeeId: employee.id,
        reviewerId: hr?.id ?? null,
        status,
        overallRating: status === "draft" ? null : 3.5 + (index % 3) * 0.5,
        summary:
          status === "draft"
            ? ""
            : `${employee.fullName} is meeting expectations for this cycle.`,
        employeeComments: status === "acknowledged" ? "Thanks for the feedback." : "",
        submittedAt: status === "draft" ? null : new Date(),
        acknowledgedAt: status === "acknowledged" ? new Date() : null,
        goals: {
          create: [
            {
              title: "Delivery quality",
              description: "Ship assigned work with low rework.",
              progress: status === "draft" ? 20 : 70 + (index % 3) * 10,
              status: status === "draft" ? "in_progress" : "completed",
            },
            {
              title: "Collaboration",
              description: "Support cross-team handoffs.",
              progress: status === "draft" ? 10 : 60,
              status: "in_progress",
            },
          ],
        },
      },
    });
  }
  console.log(`Seeded ${employees.length} performance reviews`);
}

async function seedAdminNotifications(organizationId: string) {
  const existing = await prisma.notification.count();
  if (existing > 0) {
    console.log(`Notifications already present: ${existing}`);
    return;
  }
  const admin = await prisma.employeeProfile.findFirst({
    where: { organizationId, role: "admin" },
    select: { userId: true },
  });
  if (!admin) return;
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.userId,
        title: "Leave requests need review",
        body: "Pending leave requests are waiting for a decision.",
        category: "leave",
        href: "/admin/people/leave",
      },
      {
        userId: admin.userId,
        title: "Payroll draft ready",
        body: "March 2026 payrun is still in draft.",
        category: "payroll",
        href: "/admin/hr/payroll",
      },
    ],
  });
  console.log("Seeded admin notifications");
}

async function rebuildRollups(organizationId: string) {
  const weekKeys = weekDayKeys();
  for (const key of weekKeys) {
    const day = dateFromKey(key);
    const rows = await prisma.attendance.findMany({
      where: { date: day, user: { profile: { organizationId } } },
      select: { status: true, checkIn: true, checkOut: true },
    });
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let lateCount = 0;
    let missingCheckoutCount = 0;
    for (const row of rows) {
      if (row.status === "present") presentCount += 1;
      else if (row.status === "half_day") halfDayCount += 1;
      else if (row.status === "absent") absentCount += 1;
      else if (row.status === "leave") leaveCount += 1;
      if (row.status === "present" && row.checkIn) {
        const hour = row.checkIn.getUTCHours();
        const minute = row.checkOut ? 0 : 0;
        void minute;
        // Late if check-in after ~09:15 IST (03:45 UTC)
        if (hour > 3 || (hour === 3 && row.checkIn.getUTCMinutes() > 45)) lateCount += 1;
      }
      if (row.checkIn && !row.checkOut) missingCheckoutCount += 1;
    }
    await prisma.attendanceDailyRollup.upsert({
      where: { organizationId_date: { organizationId, date: day } },
      create: {
        organizationId,
        date: day,
        presentCount,
        halfDayCount,
        absentCount,
        leaveCount,
        lateCount,
        missingCheckoutCount,
      },
      update: {
        presentCount,
        halfDayCount,
        absentCount,
        leaveCount,
        lateCount,
        missingCheckoutCount,
      },
    });
  }
  console.log(`Rebuilt attendance rollups for ${weekKeys.length} days`);
}

async function clearFailedJobs(organizationId: string) {
  const result = await prisma.backgroundJob.deleteMany({
    where: { organizationId, status: "failed" },
  });
  console.log(`Cleared failed jobs: ${result.count}`);
}

async function main() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("No organization found");

  console.log(`Repairing org ${org.name} (${org.id})…`);
  await fixInvertedLeaveDates();
  await ensureAllocationsAndBalances(org.id);
  await ensureRunningContracts(org.id);
  await alignAttendanceWithLeave(org.id);
  await seedPerformanceSample(org.id);
  await seedAdminNotifications(org.id);
  await rebuildRollups(org.id);
  await clearFailedJobs(org.id);
  console.log("Repair complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
