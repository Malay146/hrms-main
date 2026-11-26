/**
 * Compact Postgres catalog handed to the model when it writes a read-only query.
 *
 * Kept deliberately short: table, the columns that answer HR questions, and the
 * enum values. Money, bank, and contact columns are omitted so the model never
 * asks for something `sql-guard` will reject.
 */
export const SQL_SCHEMA_CATALOG = `Postgres (snake_case tables, camelCase columns need double quotes).

employee_profile: id, "organizationId", "userId", "employeeId"(badge), "fullName", role, "departmentId", "managerId", "scheduleId", "employeeType", "jobTitle", "workLocation", "joinDate", phone, status, "paidLeaveBalance", "createdAt"
department: id, "organizationId", name, code
working_schedule: id, "organizationId", name, "calendarType", active, "hoursPerWeek", "daysPerWeek"
working_schedule_line: id, "scheduleId", weekday(1=Mon..7=Sun), "startMin", "endMin", "breakMin", hours
contract: id, code, "employeeId"->employee_profile.id, "departmentId", "scheduleId", "jobTitle", "startDate", "endDate", status  (no organizationId — join employee_profile)
time_off_type: id, "organizationId", name, code, unit, "requiresAllocation", approver
time_off_allocation: id, "employeeId"->employee_profile.id, "typeId", allocated, taken, "validityYear", status  (no organizationId — join employee_profile)
leave_request: id, "organizationId", "userId", "employeeId"->employee_profile.id, "typeId", "startDate", "endDate", duration, remarks, status, "createdAt"
attendance: id, "organizationId", "userId", "employeeId"->employee_profile.id, date, "checkIn", "checkOut", status, "workedHours", "overtimeHours"
attendance_daily_rollup: id, "organizationId", date, "presentCount", "halfDayCount", "absentCount", "leaveCount", "lateCount", "missingCheckoutCount"
salary_structure: id, "organizationId", name, active
payrun: id, "organizationId", name, "structureId", "periodStart", "periodEnd", "employeeType", status
performance_cycle: id, "organizationId", name, "periodStart", "periodEnd", status
performance_review: id, "cycleId"->performance_cycle.id, "employeeId", "reviewerId", status, "overallRating", "submittedAt"  (no organizationId — join performance_cycle)
performance_goal: id, "reviewId"->performance_review.id, title, progress(0-100), status  (no organizationId — join performance_review->performance_cycle)
job_opening: id, "organizationId", code, title, department, deadline, status
candidate: id, "organizationId", "jobOpeningId", code, name, position, "experienceYears", stage, rating, source, "appliedAt", "interviewAt"

Enums:
employee_profile.status: active | inactive | on_leave
employee_profile."employeeType": full_time | intern | contractor
employee_profile.role: admin | hr_manager | hr_payroll_user | hr_payroll_manager | employee
attendance.status: present | absent | half_day | leave
leave_request.status: pending | approved | rejected
contract.status: running | expired
time_off_allocation.status: draft | approved | refused
payrun.status: draft | computed | validated | paid
performance_cycle.status: open | closed
performance_review.status: draft | submitted | acknowledged
performance_goal.status: not_started | in_progress | completed
job_opening.status: active | closed
candidate.stage: applied | screening | interview | technical | offer | hired | rejected

Conventions the app uses (match these so numbers agree with the UI):
- Total employees = COUNT(*) FROM employee_profile scoped to the org (all statuses).
- Active employees = status = 'active' AND no approved leave_request covering today.
- "on leave today" = leave_request.status='approved' AND "startDate" <= today AND "endDate" >= today.
- Attendance "present" counts include 'half_day'.
- Department size = all profiles in the department, matching the Departments page.
- "Manager" means someone other profiles point at via "managerId" — not a role value. Role 'hr_manager' is an HR permission level, not a people manager.
- employee_profile.status = 'on_leave' is a roster state; it is not the same as having approved leave today.
- Dates are DATE columns in Asia/Kolkata terms; use CURRENT_DATE for today.
- Every column listed under "Enums" above is a Postgres enum. Cast it with ::text before comparing to a string, or the query fails with "operator does not exist".
  Correct:   WHERE "employeeType"::text = 'intern'
  Correct:   WHERE status::text IN ('active', 'on_leave')
  Incorrect: WHERE "employeeType" = 'intern'`;

/** Rules for shaping the query itself. */
export const SQL_QUERY_RULES = `Write ONE read-only Postgres SELECT (a leading CTE with WITH is fine).

Hard requirements:
- Scope every query to the organization with "organizationId" = $1 (join a parent table when the table has no organizationId).
- $1 is the only bind parameter. Never inline an organization id.
- No semicolons, no comments, no CTE that writes, no INTO, no SET.
- Read only these tables: employee_profile, department, working_schedule, working_schedule_line, contract, time_off_type, time_off_allocation, leave_request, attendance, attendance_daily_rollup, salary_structure, payrun, performance_cycle, performance_review, performance_goal, job_opening, candidate.
- Never select wage, bankAccount, basic, gross, net, deductions, personalEmail, or address. Those are blocked.
- Prefer aggregates for "how many" questions. Add ORDER BY and a small LIMIT when listing rows.
- Alias every output column with a readable, unambiguous name, e.g. COUNT(*)::int AS "internCount". The alias is the only label the answer is written from, so a vague alias produces a wrong-sounding answer.
- For an "X vs Y" comparison return one row per group (GROUP BY) rather than separate unlabelled totals.
- Only compare enum values that appear in the Enums list above. If the question names a category that is not an enum value, model it another way instead of inventing one.`;
