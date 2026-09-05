"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { daysPerWeek, lineHours, weeklyHours } from "@/lib/people/schedule-hours";
import { firstZodError, upsertScheduleSchema } from "@/lib/shared/validations";
import type { ActionResult } from "@/lib/shared/types";

export type ScheduleListItem = {
  id: string;
  name: string;
  calendarType: "fixed" | "variable";
  timezone: string;
  active: boolean;
  daysPerWeek: number;
  hoursPerWeek: number;
  lines: {
    id: string;
    weekday: number;
    startMin: number;
    endMin: number;
    breakMin: number;
    hours: number;
  }[];
};

function mapSchedule(row: {
  id: string;
  name: string;
  calendarType: "fixed" | "variable";
  timezone: string;
  active: boolean;
  daysPerWeek: number;
  hoursPerWeek: { toString(): string } | number;
  lines: {
    id: string;
    weekday: number;
    startMin: number;
    endMin: number;
    breakMin: number;
    hours: { toString(): string } | number;
  }[];
}): ScheduleListItem {
  return {
    id: row.id,
    name: row.name,
    calendarType: row.calendarType,
    timezone: row.timezone,
    active: row.active,
    daysPerWeek: row.daysPerWeek,
    hoursPerWeek: Number(row.hoursPerWeek),
    lines: row.lines
      .slice()
      .sort((a, b) => a.weekday - b.weekday)
      .map((line) => ({
        id: line.id,
        weekday: line.weekday,
        startMin: line.startMin,
        endMin: line.endMin,
        breakMin: line.breakMin,
        hours: Number(line.hours),
      })),
  };
}

export async function listSchedules(): Promise<ActionResult<ScheduleListItem[]>> {
  try {
    await requirePermission("managePeople");
    const rows = await prisma.workingSchedule.findMany({
      include: { lines: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return { ok: true, data: rows.map(mapSchedule) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load schedules.") };
  }
}

export async function getScheduleAction(
  id: string,
): Promise<ActionResult<ScheduleListItem>> {
  try {
    await requirePermission("managePeople");
    const row = await prisma.workingSchedule.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!row) return { ok: false, error: "Schedule not found." };
    return { ok: true, data: mapSchedule(row) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load schedule.") };
  }
}

export async function upsertScheduleAction(input: {
  id?: string;
  name: string;
  calendarType: "fixed" | "variable";
  timezone?: string;
  active?: boolean;
  lines: { weekday: number; startMin: number; endMin: number; breakMin: number }[];
}): Promise<ActionResult<ScheduleListItem>> {
  try {
    const user = await requirePermission("managePeople");
    const parsed = upsertScheduleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstZodError(parsed.error) };
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    if (!profile) {
      return { ok: false, error: "Your employee profile is missing." };
    }

    const lines = parsed.data.lines.map((line) => ({
      ...line,
      hours: lineHours(line.startMin, line.endMin, line.breakMin),
    }));
    const hours = weeklyHours(lines);
    const days = daysPerWeek(lines);

    const saved = await prisma.$transaction(async (tx) => {
      if (parsed.data.id) {
        await tx.workingScheduleLine.deleteMany({
          where: { scheduleId: parsed.data.id },
        });
        return tx.workingSchedule.update({
          where: { id: parsed.data.id },
          data: {
            name: parsed.data.name.trim(),
            calendarType: parsed.data.calendarType,
            timezone: parsed.data.timezone,
            active: parsed.data.active,
            hoursPerWeek: hours,
            daysPerWeek: days,
            lines: {
              create: lines.map((line) => ({
                weekday: line.weekday,
                startMin: line.startMin,
                endMin: line.endMin,
                breakMin: line.breakMin,
                hours: line.hours,
              })),
            },
          },
          include: { lines: true },
        });
      }

      return tx.workingSchedule.create({
        data: {
          organizationId: profile.organizationId,
          name: parsed.data.name.trim(),
          calendarType: parsed.data.calendarType,
          timezone: parsed.data.timezone,
          active: parsed.data.active,
          hoursPerWeek: hours,
          daysPerWeek: days,
          lines: {
            create: lines.map((line) => ({
              weekday: line.weekday,
              startMin: line.startMin,
              endMin: line.endMin,
              breakMin: line.breakMin,
              hours: line.hours,
            })),
          },
        },
        include: { lines: true },
      });
    });

    revalidatePath("/admin/people/schedules");
    return { ok: true, data: mapSchedule(saved) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save schedule.") };
  }
}
