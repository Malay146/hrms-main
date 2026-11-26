import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import { upsertAttendanceAction } from "@/lib/actions/people/attendance";
import {
  createDepartmentAction,
  deleteDepartmentAction,
  renameDepartmentAction,
} from "@/lib/actions/people/departments";
import { createEmployeeAction, getEmployeeHub, updateEmployeeAction } from "@/lib/actions/people/employees";
import { applyLeaveForEmployeeAction, decideLeaveAction } from "@/lib/actions/people/leave";
import { dateFromKey, isLateCheckIn, kolkataTodayKey, toDateKey } from "@/lib/shared/dates";
import type { LeaveType, Role, SessionUser } from "@/lib/shared/types";
import { COPILOT_NO_PAYROLL, type AssistantPlan } from "@/lib/ai/copilot";
import { sqlAttendanceSummary, sqlDepartmentHeadcount, sqlFindPeople, sqlLatestPaidPayrollNet, sqlLeaveToday, sqlOrgActiveHeadcount, sqlOrgHeadcount, sqlPendingLeave, sqlPeopleInDepartment, sqlPerformanceSummary } from "@/lib/ai/copilot-query";

export type AssistantExecuteResult = {
  answer: string;
  source: string;
};

function arg(args: Record<string, string>, key: string) {
  return (args[key] ?? "").trim();
}

async function orgIdFor(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
  return profile?.organizationId ?? null;
}

async function findEmployee(organizationId: string, query: string) {
  const needle = query.trim();
  if (!needle) return { error: "Which employee should I use?" };

  const exactId = await prisma.employeeProfile.findFirst({
    where: { organizationId, employeeId: { equals: needle, mode: "insensitive" } },
    select: { employeeId: true, userId: true, fullName: true },
  });
  if (exactId) return { employee: exactId };

  const exactName = await prisma.employeeProfile.findMany({
    where: { organizationId, fullName: { equals: needle, mode: "insensitive" } },
    select: { employeeId: true, userId: true, fullName: true },
  });
  if (exactName.length === 1 && exactName[0]) return { employee: exactName[0] };
  if (exactName.length > 1) {
    return { error: `Several people are named ${needle}. Use an employee ID.` };
  }

  const partial = await prisma.employeeProfile.findMany({
    where: { organizationId, fullName: { contains: needle, mode: "insensitive" } },
    select: { employeeId: true, userId: true, fullName: true },
    take: 6,
  });
  if (partial.length === 1 && partial[0]) return { employee: partial[0] };
  if (partial.length > 1) {
    const names = partial.map((row) => `${row.fullName} (${row.employeeId})`).join(", ");
    return { error: `I found more than one match: ${names}. Tell me the employee ID.` };
  }
  return { error: `I could not find an employee matching “${needle}”.` };
}

async function findDepartment(organizationId: string, query: string) {
  const needle = query.trim();
  if (!needle) return { error: "Which department should I use?" };

  const exact = await prisma.department.findFirst({
    where: { organizationId, name: { equals: needle, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (exact) return { department: exact };

  const partial = await prisma.department.findMany({
    where: { organizationId, name: { contains: needle, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 6,
  });
  if (partial.length === 1 && partial[0]) return { department: partial[0] };
  if (partial.length > 1) {
    return { error: `Several departments match that name: ${partial.map((row) => row.name).join(", ")}.` };
  }
  return { error: `I could not find a department named “${needle}”.` };
}

async function pendingLeaveFor(userId: string) {
  const rows = await prisma.leaveRequest.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true, startDate: true, endDate: true },
  });
  if (rows.length === 0) return { error: "There is no pending leave request for that person." };
  if (rows.length > 1) {
    return {
      error: `${rows.length} pending leave requests exist for that person. Approve or reject from Leave, or name the dates.`,
      leaveId: rows[0]?.id,
    };
  }
  return { leaveId: rows[0]?.id };
}

const ROLES: Role[] = ["admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "employee"];

function parseRole(value: string | undefined): Role {
  const role = (value ?? "employee").trim().toLowerCase().replace(/\s+/g, "_");
  if (ROLES.includes(role as Role)) return role as Role;
  return "employee";
}

async function executeCreateEmployee(user: SessionUser, args: Record<string, string>) {
  if (!hasPermission(user.role, "createUsers")) {
    return {
      answer: "Adding a new employee needs the create-users permission. An admin can do that from Employees.",
      source: "Permission check",
    };
  }
  const fullName = arg(args, "fullName") || arg(args, "employee") || arg(args, "name");
  const email = arg(args, "email");
  const department = arg(args, "department");
  const jobTitle = arg(args, "jobTitle") || arg(args, "title") || "Team member";
  if (!fullName || !email || !department) {
    return {
      answer: "To add an employee I need their full name, email, department, and job title.",
      source: "Missing fields",
    };
  }
  const result = await createEmployeeAction({
    fullName,
    email,
    department,
    jobTitle,
    role: parseRole(args.role),
    phone: arg(args, "phone") || undefined,
  });
  if (!result.ok) {
    return { answer: result.error, source: "Create employee" };
  }
  revalidatePath("/admin");
  return {
    answer: `Added ${fullName} (${result.data.employeeId}) in ${department} as ${jobTitle}. Login details are emailed when mail is configured.`,
    source: `Created employee ${result.data.employeeId}`,
  };
}

async function executeUpdateEmployee(user: SessionUser, orgId: string, args: Record<string, string>) {
  if (!hasPermission(user.role, "managePeople")) {
    return { answer: "You do not have permission to change employee records.", source: "Permission check" };
  }
  const lookup = await findEmployee(orgId, arg(args, "employee") || arg(args, "fullName") || arg(args, "name"));
  if ("error" in lookup || !lookup.employee) {
    return { answer: lookup.error ?? "Employee not found.", source: "Employee lookup" };
  }
  const hub = await getEmployeeHub(lookup.employee.employeeId);
  if (!hub.ok) {
    return { answer: hub.error, source: "Employee lookup" };
  }
  const current = hub.data.employee;
  let departmentId = current.departmentId;
  const departmentName = arg(args, "department");
  if (departmentName) {
    const dept = await findDepartment(orgId, departmentName);
    if ("error" in dept || !dept.department) {
      return { answer: dept.error ?? "Department not found.", source: "Department lookup" };
    }
    departmentId = dept.department.id;
  }
  const statusRaw = arg(args, "status").toLowerCase().replace(/\s+/g, "_");
  const status =
    statusRaw === "inactive" || statusRaw === "active" || statusRaw === "on_leave"
      ? statusRaw
      : current.status;
  const typeRaw = arg(args, "employeeType").toLowerCase().replace(/\s+/g, "_");
  const employeeType =
    typeRaw === "full_time" || typeRaw === "intern" || typeRaw === "contractor"
      ? typeRaw
      : current.employeeType;

  const result = await updateEmployeeAction({
    employeeId: current.employeeId,
    fullName: arg(args, "fullName") || current.fullName,
    departmentId,
    managerId: current.managerId,
    scheduleId: current.scheduleId,
    jobTitle: arg(args, "jobTitle") || arg(args, "title") || current.jobTitle,
    companyName: current.companyName,
    workLocation: current.workLocation,
    employeeType,
    status,
    phone: arg(args, "phone") || current.phone,
    personalEmail: current.personalEmail,
    address: current.address,
    bankAccount: current.bankAccount,
    joinDate: current.joinDate,
  });
  if (!result.ok) {
    return { answer: result.error, source: "Update employee" };
  }
  revalidatePath("/admin");
  if (result.data.kind === "deactivated") {
    return {
      answer: `Removed ${lookup.employee.fullName} (${result.data.employeeId}).`,
      source: `Updated employee ${result.data.employeeId}`,
    };
  }
  const updated = result.data.employee;
  return {
    answer: `Updated ${updated.fullName} (${updated.employeeId}). Status is ${updated.statusLabel}, department is ${updated.departmentName}, title is ${updated.jobTitle}.`,
    source: `Updated employee ${updated.employeeId}`,
  };
}

async function executeCreateDepartment(user: SessionUser, args: Record<string, string>) {
  if (!hasPermission(user.role, "managePeople")) {
    return { answer: "You do not have permission to add departments.", source: "Permission check" };
  }
  const name = arg(args, "name") || arg(args, "department");
  if (!name) {
    return { answer: "Which department should I create?", source: "Missing fields" };
  }
  const result = await createDepartmentAction({ name, code: arg(args, "code") || undefined });
  if (!result.ok) return { answer: result.error, source: "Create department" };
  revalidatePath("/admin");
  return {
    answer: `Created department ${result.data.name} (${result.data.code}). It will show on the dashboard distribution once people are added.`,
    source: `Created department ${result.data.name}`,
  };
}

async function executeDeleteDepartment(user: SessionUser, orgId: string, args: Record<string, string>) {
  if (!hasPermission(user.role, "managePeople")) {
    return { answer: "You do not have permission to remove departments.", source: "Permission check" };
  }
  const lookup = await findDepartment(orgId, arg(args, "name") || arg(args, "department"));
  if ("error" in lookup || !lookup.department) {
    return { answer: lookup.error ?? "Department not found.", source: "Department lookup" };
  }
  const result = await deleteDepartmentAction({ id: lookup.department.id });
  if (!result.ok) return { answer: result.error, source: "Delete department" };
  revalidatePath("/admin");
  return {
    answer: `Removed department ${lookup.department.name} from the organisation.`,
    source: `Deleted department ${lookup.department.name}`,
  };
}

async function executeRenameDepartment(user: SessionUser, orgId: string, args: Record<string, string>) {
  if (!hasPermission(user.role, "managePeople")) {
    return { answer: "You do not have permission to rename departments.", source: "Permission check" };
  }
  const lookup = await findDepartment(orgId, arg(args, "name") || arg(args, "department"));
  if ("error" in lookup || !lookup.department) {
    return { answer: lookup.error ?? "Department not found.", source: "Department lookup" };
  }
  const newName = arg(args, "newName") || arg(args, "to");
  if (!newName) {
    return { answer: "What should the department be renamed to?", source: "Missing fields" };
  }
  const result = await renameDepartmentAction({ id: lookup.department.id, name: newName });
  if (!result.ok) return { answer: result.error, source: "Rename department" };
  revalidatePath("/admin");
  return {
    answer: `Renamed ${lookup.department.name} to ${result.data.name}.`,
    source: `Renamed department ${result.data.name}`,
  };
}

async function executeLeave(user: SessionUser, orgId: string, tool: "approve_leave" | "reject_leave", args: Record<string, string>) {
  if (!hasPermission(user.role, "approveLeave")) {
    return { answer: "You do not have permission to decide leave requests.", source: "Permission check" };
  }
  const lookup = await findEmployee(orgId, arg(args, "employee") || arg(args, "name"));
  if ("error" in lookup || !lookup.employee) {
    return { answer: lookup.error ?? "Employee not found.", source: "Employee lookup" };
  }
  const pending = await pendingLeaveFor(lookup.employee.userId);
  if ("error" in pending || !pending.leaveId) {
    return { answer: pending.error ?? "No pending leave found.", source: "Leave lookup" };
  }
  const decision = tool === "approve_leave" ? "approved" : "rejected";
  const comment =
    arg(args, "comment") ||
    (decision === "approved" ? "Approved via HR assistant" : "Rejected via HR assistant");
  const result = await decideLeaveAction({
    leaveId: pending.leaveId,
    decision,
    adminComment: comment,
  });
  if (!result.ok) return { answer: result.error, source: "Leave decision" };
  revalidatePath("/admin");
  return {
    answer: `${decision === "approved" ? "Approved" : "Rejected"} leave for ${lookup.employee.fullName}. Dashboard pending approvals and leave-today counts will refresh.`,
    source: `${decision} leave for ${lookup.employee.employeeId}`,
  };
}

async function executeAttendance(user: SessionUser, orgId: string, args: Record<string, string>) {
  if (!hasPermission(user.role, "managePeople")) {
    return { answer: "You do not have permission to change attendance.", source: "Permission check" };
  }
  const lookup = await findEmployee(orgId, arg(args, "employee") || arg(args, "name"));
  if ("error" in lookup || !lookup.employee) {
    return { answer: lookup.error ?? "Employee not found.", source: "Employee lookup" };
  }
  const dateRaw = arg(args, "date").toLowerCase();
  const date = !dateRaw || dateRaw === "today" ? kolkataTodayKey() : dateRaw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { answer: "Use a date as YYYY-MM-DD, or say today.", source: "Invalid date" };
  }
  const statusRaw = arg(args, "status").toLowerCase().replace(/[ -]/g, "_");
  const status =
    statusRaw === "present" || statusRaw === "absent" || statusRaw === "half_day" || statusRaw === "leave"
      ? statusRaw
      : null;
  if (!status) {
    return { answer: "Attendance status must be present, absent, half-day, or leave.", source: "Invalid status" };
  }
  const result = await upsertAttendanceAction({
    userId: lookup.employee.userId,
    date,
    status,
    notes: "Updated via HR assistant",
  });
  if (!result.ok) return { answer: result.error, source: "Attendance update" };
  revalidatePath("/admin");
  return {
    answer: `Marked ${lookup.employee.fullName} as ${status.replace("_", " ")} on ${date}. Present-today on the dashboard will update.`,
    source: `Attendance ${status} for ${lookup.employee.employeeId}`,
  };
}

async function executeApplyLeave(user: SessionUser, orgId: string, args: Record<string, string>) {
  if (!hasPermission(user.role, "managePeople")) {
    return { answer: "You do not have permission to apply leave for someone else.", source: "Permission check" };
  }
  const lookup = await findEmployee(orgId, arg(args, "employee") || arg(args, "name"));
  if ("error" in lookup || !lookup.employee) {
    return { answer: lookup.error ?? "Employee not found.", source: "Employee lookup" };
  }
  const typeRaw = arg(args, "type").toLowerCase();
  const type: LeaveType = typeRaw === "sick" || typeRaw === "unpaid" || typeRaw === "paid" ? typeRaw : "paid";
  const result = await applyLeaveForEmployeeAction({
    userId: lookup.employee.userId,
    type,
    startDate: arg(args, "startDate"),
    endDate: arg(args, "endDate"),
    remarks: arg(args, "remarks") || "Requested via HR assistant",
  });
  if (!result.ok) return { answer: result.error, source: "Apply leave" };
  revalidatePath("/admin");
  return {
    answer: `Submitted ${type} leave for ${lookup.employee.fullName} from ${arg(args, "startDate")} to ${arg(args, "endDate")}. It is pending approval.`,
    source: `Applied leave for ${lookup.employee.employeeId}`,
  };
}

async function executeClock(user: SessionUser, orgId: string, tool: "clock_in" | "clock_out", args: Record<string, string>) {
  if (!hasPermission(user.role, "managePeople")) {
    return { answer: "You do not have permission to change attendance.", source: "Permission check" };
  }
  const lookup = await findEmployee(orgId, arg(args, "employee") || arg(args, "name"));
  if ("error" in lookup || !lookup.employee) {
    return { answer: lookup.error ?? "Employee not found.", source: "Employee lookup" };
  }
  const dateRaw = arg(args, "date").toLowerCase();
  const date = !dateRaw || dateRaw === "today" ? kolkataTodayKey() : dateRaw;
  const now = new Date().toISOString();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: lookup.employee.userId, date: dateFromKey(date) } },
    select: { checkIn: true, checkOut: true, status: true },
  });

  if (tool === "clock_in") {
    if (existing?.checkIn) {
      return {
        answer: `${lookup.employee.fullName} is already clocked in today.`,
        source: `Clock in ${lookup.employee.employeeId}`,
      };
    }
    const result = await upsertAttendanceAction({
      userId: lookup.employee.userId,
      date,
      status: "present",
      checkIn: now,
      notes: "Clocked in via HR assistant",
    });
    if (!result.ok) return { answer: result.error, source: "Clock in" };
    revalidatePath("/admin");
    return {
      answer: `Clocked in ${lookup.employee.fullName} for ${date}.`,
      source: `Clock in ${lookup.employee.employeeId}`,
    };
  }

  if (!existing?.checkIn) {
    return {
      answer: `${lookup.employee.fullName} has no check-in today, so I cannot clock them out.`,
      source: `Clock out ${lookup.employee.employeeId}`,
    };
  }
  if (existing.checkOut) {
    return {
      answer: `${lookup.employee.fullName} is already clocked out today.`,
      source: `Clock out ${lookup.employee.employeeId}`,
    };
  }
  const result = await upsertAttendanceAction({
    userId: lookup.employee.userId,
    date,
    status: existing.status === "half_day" ? "half_day" : "present",
    checkIn: existing.checkIn.toISOString(),
    checkOut: now,
    notes: "Clocked out via HR assistant",
  });
  if (!result.ok) return { answer: result.error, source: "Clock out" };
  revalidatePath("/admin");
  return {
    answer: `Clocked out ${lookup.employee.fullName} for ${date}.`,
    source: `Clock out ${lookup.employee.employeeId}`,
  };
}

export async function executeAssistantLookup(
  user: SessionUser,
  plan: Extract<AssistantPlan, { kind: "lookup" }>,
): Promise<AssistantExecuteResult> {
  const orgId = await orgIdFor(user.id);
  if (!orgId) {
    return { answer: "No organisation is linked to this account.", source: "Permission check" };
  }

  if (plan.tool === "lookup_departments") {
    const rows = await sqlDepartmentHeadcount(orgId);
    if (rows.length === 0) {
      return { answer: "There are no departments yet.", source: "HR assistant" };
    }
    const lines = rows.map((row) => `• ${row.name} — ${row.headcount} employees`).join("\n");
    return {
      answer: `There are ${rows.length} departments:\n${lines}`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_headcount") {
    const department = arg(plan.args, "department");
    const other = arg(plan.args, "other");

    if (!department && !other) {
      const [total, active] = await Promise.all([
        sqlOrgHeadcount(orgId),
        sqlOrgActiveHeadcount(orgId),
      ]);
      if (total === active) {
        return {
          answer: `There are ${total} employees.`,
          source: "HR assistant",
        };
      }
      return {
        answer: `There are ${total} employees (${active} active).`,
        source: "HR assistant",
      };
    }

    if (other) {
      const left = await sqlDepartmentHeadcount(orgId, department);
      const right = await sqlDepartmentHeadcount(orgId, other);
      const leftLine = left[0]
        ? `${left[0].name}: ${left[0].headcount}`
        : `No department matching “${department}”.`;
      const rightLine = right[0]
        ? `${right[0].name}: ${right[0].headcount}`
        : `No department matching “${other}”.`;
      return {
        answer: `${leftLine}\n${rightLine}`,
        source: "HR assistant",
      };
    }

    const rows = await sqlDepartmentHeadcount(orgId, department);
    if (rows.length === 0) {
      return {
        answer: `I could not find a department matching “${department}”.`,
        source: "HR assistant",
      };
    }
    if (rows.length === 1 && rows[0]) {
      const row = rows[0];
      const noun = row.headcount === 1 ? "employee" : "employees";
      return {
        answer: `${row.name} has ${row.headcount} ${noun}.`,
        source: "HR assistant",
      };
    }
    const lines = rows.map((row) => `• ${row.name} — ${row.headcount}`).join("\n");
    return {
      answer: `Several departments match “${department}”:\n${lines}`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_person") {
    const query = arg(plan.args, "query") || arg(plan.args, "employee") || arg(plan.args, "name");
    if (!query) return { answer: "Who should I look up?", source: "HR assistant" };
    const people = await sqlFindPeople(orgId, query);
    if (people.length === 0) {
      return { answer: `I could not find anyone matching “${query}”.`, source: "HR assistant" };
    }
    if (people.length === 1 && people[0]) {
      const row = people[0];
      return {
        answer: `${row.fullName} · ${row.employeeId} · ${row.department} · ${row.jobTitle}`,
        source: "HR assistant",
      };
    }
    const names = people
      .map((row) => `• ${row.fullName} (${row.employeeId}, ${row.department})`)
      .join("\n");
    return { answer: `Found ${people.length} people:\n${names}`, source: "HR assistant" };
  }

  if (plan.tool === "lookup_leave_balance") {
    const lookup = await findEmployee(orgId, arg(plan.args, "employee") || arg(plan.args, "query"));
    if ("error" in lookup || !lookup.employee) {
      return { answer: lookup.error ?? "Employee not found.", source: "HR assistant" };
    }
    const profile = await prisma.employeeProfile.findFirst({
      where: { organizationId: orgId, employeeId: lookup.employee.employeeId },
      select: { fullName: true, employeeId: true, paidLeaveBalance: true },
    });
    if (!profile) return { answer: "Employee profile is missing.", source: "HR assistant" };
    return {
      answer: `${profile.fullName} has ${profile.paidLeaveBalance} paid leave day(s) remaining.`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_reports") {
    const lookup = await findEmployee(orgId, arg(plan.args, "employee") || arg(plan.args, "query"));
    if ("error" in lookup || !lookup.employee) {
      return { answer: lookup.error ?? "Employee not found.", source: "HR assistant" };
    }
    const profile = await prisma.employeeProfile.findFirst({
      where: { organizationId: orgId, employeeId: lookup.employee.employeeId },
      select: {
        fullName: true,
        employeeId: true,
        manager: { select: { fullName: true, employeeId: true } },
        reports: {
          where: { status: { not: "inactive" } },
          select: { fullName: true, employeeId: true },
          take: 40,
        },
      },
    });
    if (!profile) return { answer: "Employee profile is missing.", source: "HR assistant" };
    const direction = arg(plan.args, "direction");
    if (direction === "manager") {
      if (!profile.manager) {
        return {
          answer: `${profile.fullName} has no manager on file.`,
          source: "HR assistant",
        };
      }
      return {
        answer: `${profile.fullName} reports to ${profile.manager.fullName} (${profile.manager.employeeId}).`,
        source: "HR assistant",
      };
    }
    if (profile.reports.length === 0) {
      return {
        answer: `Nobody is listed as reporting to ${profile.fullName}.`,
        source: "HR assistant",
      };
    }
    const names = profile.reports.map((row) => `• ${row.fullName} (${row.employeeId})`).join("\n");
    return {
      answer: `${profile.reports.length} ${profile.reports.length === 1 ? "person reports" : "people report"} to ${profile.fullName}:\n${names}`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_attendance_exceptions") {
    const today = kolkataTodayKey();
    const rows = await prisma.attendance.findMany({
      where: {
        date: dateFromKey(today),
        organizationId: orgId,
      },
      select: {
        checkIn: true,
        checkOut: true,
        status: true,
        employee: { select: { fullName: true, employeeId: true, status: true } },
      },
    });
    const kind = arg(plan.args, "kind");
    const activeRows = rows.filter((row) => row.employee.status !== "inactive");
    const matches =
      kind === "missing_checkout"
        ? activeRows.filter((row) => row.checkIn && !row.checkOut && row.status === "present")
        : activeRows.filter((row) => row.checkIn && isLateCheckIn(row.checkIn));
    if (matches.length === 0) {
      return {
        answer:
          kind === "missing_checkout"
            ? "Nobody who checked in today is missing a checkout."
            : "Nobody is flagged late today.",
        source: "HR assistant",
      };
    }
    const names = matches
      .slice(0, 20)
      .map((row) => row.employee.fullName ?? row.employee.employeeId ?? "Employee")
      .join("; ");
    const extra = matches.length > 20 ? ` (and ${matches.length - 20} more)` : "";
    return {
      answer: `${matches.length} ${kind === "missing_checkout" ? "missing checkout" : "late"}: ${names}${extra}.`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_leave_today") {
    const { total, rows } = await sqlLeaveToday(orgId);
    if (total === 0) {
      return { answer: "Nobody is on approved leave today.", source: "HR assistant" };
    }
    const names = rows.map((row) => `• ${row.fullName} (${row.employeeId}, ${row.department})`).join("\n");
    const extra = total > rows.length ? `\n…and ${total - rows.length} more` : "";
    return {
      answer: `${total} on approved leave today:\n${names}${extra}`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_pending_leave") {
    const { total, rows } = await sqlPendingLeave(orgId);
    if (total === 0) {
      return { answer: "There are no pending leave requests.", source: "HR assistant" };
    }
    const names = rows
      .map((row) => `• ${row.fullName} (${row.employeeId}) ${toDateKey(row.startDate)}–${toDateKey(row.endDate)}`)
      .join("\n");
    const extra = total > rows.length ? `\n…and ${total - rows.length} more` : "";
    return {
      answer: `${total} pending leave request(s):\n${names}${extra}`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_attendance_summary") {
    const row = await sqlAttendanceSummary(orgId);
    const leaveToday = await sqlLeaveToday(orgId);
    const pct = row.monthRows > 0 ? Math.round((row.monthPresent / row.monthRows) * 1000) / 10 : 0;
    return {
      answer: `Today: ${row.todayPresent} present, ${row.todayAbsent} absent, ${leaveToday.total} on leave. This month ${row.monthPresent}/${row.monthRows} attendance rows are present or half-day (${pct}%).`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_payroll") {
    if (!hasPermission(user.role, "viewPayrollAll")) {
      return { answer: COPILOT_NO_PAYROLL, source: "HR assistant" };
    }
    const row = await sqlLatestPaidPayrollNet(orgId);
    if (!row) {
      return { answer: "There is no paid payrun yet.", source: "HR assistant" };
    }
    return {
      answer: `Latest paid payrun “${row.name}”: net ₹${Math.round(row.net).toLocaleString("en-IN")} across ${row.slips} payslip(s).`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_performance") {
    const row = await sqlPerformanceSummary(orgId);
    const avg = row.avgRating == null ? "no submitted ratings yet" : `${Math.round(row.avgRating * 10) / 10} out of 5`;
    return {
      answer: `Average review rating: ${avg}. ${row.draft} draft, ${row.submitted} submitted, ${row.acknowledged} acknowledged.`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_org_overview") {
    const [headcount, active, pending, onLeave, attendance] = await Promise.all([
      sqlOrgHeadcount(orgId),
      sqlOrgActiveHeadcount(orgId),
      sqlPendingLeave(orgId),
      sqlLeaveToday(orgId),
      sqlAttendanceSummary(orgId),
    ]);
    return {
      answer: `${headcount} employees (${active} active). Today: ${attendance.todayPresent} present, ${onLeave.total} on leave, ${attendance.todayAbsent} absent. ${pending.total} leave request(s) pending.`,
      source: "HR assistant",
    };
  }

  if (plan.tool === "lookup_people") {
    const department = arg(plan.args, "department");
    if (!department) {
      return { answer: "Which department should I look up?", source: "HR assistant" };
    }
    const result = await sqlPeopleInDepartment(orgId, department);
    if (result.matches.length > 1) {
      const lines = result.matches.map((row) => `• ${row.name} — ${row.headcount}`).join("\n");
      return {
        answer: `Several departments match “${department}”:\n${lines}`,
        source: "HR assistant",
      };
    }
    if (!result.department) {
      return {
        answer: `I could not find a department matching “${department}”.`,
        source: "HR assistant",
      };
    }
    if (result.total === 0) {
      return {
        answer: `${result.department.name} has no employees yet.`,
        source: "HR assistant",
      };
    }
    const names = result.people
      .map((row) => `• ${row.fullName} (${row.employeeId}, ${row.jobTitle})`)
      .join("\n");
    const extra = result.total > result.people.length ? `\n…and ${result.total - result.people.length} more` : "";
    return {
      answer: `${result.total} employees in ${result.department.name}:\n${names}${extra}`,
      source: "HR assistant",
    };
  }

  return { answer: "I could not look that up.", source: "HR assistant" };
}

export async function executeAssistantPlan(
  user: SessionUser,
  plan: Extract<AssistantPlan, { kind: "act" }>,
): Promise<AssistantExecuteResult> {
  const orgId = await orgIdFor(user.id);
  if (!orgId) {
    return { answer: "No organisation is linked to this account.", source: "Permission check" };
  }

  const { tool, args } = plan;
  switch (tool) {
    case "create_employee":
      return executeCreateEmployee(user, args);
    case "update_employee":
      return executeUpdateEmployee(user, orgId, args);
    case "create_department":
      return executeCreateDepartment(user, args);
    case "delete_department":
      return executeDeleteDepartment(user, orgId, args);
    case "rename_department":
      return executeRenameDepartment(user, orgId, args);
    case "approve_leave":
      return executeLeave(user, orgId, "approve_leave", args);
    case "reject_leave":
      return executeLeave(user, orgId, "reject_leave", args);
    case "mark_attendance":
      return executeAttendance(user, orgId, args);
    case "apply_leave":
      return executeApplyLeave(user, orgId, args);
    case "clock_in":
      return executeClock(user, orgId, "clock_in", args);
    case "clock_out":
      return executeClock(user, orgId, "clock_out", args);
    default:
      return { answer: "I do not know how to do that yet.", source: "Unknown action" };
  }
}
