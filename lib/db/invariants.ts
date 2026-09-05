/** Exact SQL later tasks copy verbatim into Prisma migrations. Do not apply here. */
export const INVARIANT_SQL = {
  leaveDatesOrdered: `ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_dates_ordered"
  CHECK ("endDate" >= "startDate");`,

  leaveDurationNonneg: `ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_duration_nonneg"
  CHECK ("duration" >= 0);`,

  contractDatesOrdered: `ALTER TABLE "contract"
  ADD CONSTRAINT "contract_dates_ordered"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");`,

  contractWageNonneg: `ALTER TABLE "contract"
  ADD CONSTRAINT "contract_wage_nonneg"
  CHECK ("wage" >= 0);`,

  attendanceCheckoutNeedsCheckin: `ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_checkout_needs_checkin"
  CHECK ("checkOut" IS NULL OR "checkIn" IS NOT NULL);`,

  workingScheduleLineWeekday: `ALTER TABLE "working_schedule_line"
  ADD CONSTRAINT "working_schedule_line_weekday"
  CHECK ("weekday" >= 0 AND "weekday" <= 6);`,

  workingScheduleLineRange: `ALTER TABLE "working_schedule_line"
  ADD CONSTRAINT "working_schedule_line_range"
  CHECK ("endMin" > "startMin" AND "startMin" >= 0 AND "endMin" <= 24 * 60);`,

  workingScheduleHoursPositive: `ALTER TABLE "working_schedule"
  ADD CONSTRAINT "working_schedule_hours_positive"
  CHECK ("hoursPerWeek" > 0 AND "daysPerWeek" BETWEEN 1 AND 7);`,

  timeOffAllocationAmounts: `ALTER TABLE "time_off_allocation"
  ADD CONSTRAINT "time_off_allocation_amounts"
  CHECK ("allocated" >= 0 AND "taken" >= 0 AND "taken" <= "allocated" + 0.01);`,

  payslipAmountsNonneg: `ALTER TABLE "payslip"
  ADD CONSTRAINT "payslip_amounts_nonneg"
  CHECK ("wage" >= 0 AND "gross" >= 0);`,

  performanceGoalProgress: `ALTER TABLE "performance_goal"
  ADD CONSTRAINT "performance_goal_progress"
  CHECK ("progress" >= 0 AND "progress" <= 100);`,

  noOverlappingApprovedLeave: `CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_no_approved_overlap"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  )
  WHERE (status = 'approved');`,
} as const;
