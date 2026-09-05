-- Repair rows that would fail the CHECKs below.
UPDATE "leave_request" SET "endDate" = "startDate" WHERE "endDate" < "startDate";
UPDATE "leave_request" SET "duration" = 0 WHERE "duration" < 0;
UPDATE "contract" SET "endDate" = "startDate" WHERE "endDate" IS NOT NULL AND "endDate" < "startDate";
UPDATE "contract" SET "wage" = 0 WHERE "wage" < 0;
UPDATE "attendance" SET "checkOut" = NULL WHERE "checkIn" IS NULL AND "checkOut" IS NOT NULL;
UPDATE "working_schedule_line" SET "weekday" = 7 WHERE "weekday" = 0;
UPDATE "working_schedule_line" SET "weekday" = 1 WHERE "weekday" < 1;
UPDATE "working_schedule_line" SET "weekday" = 7 WHERE "weekday" > 7;
UPDATE "working_schedule_line" SET "startMin" = 0 WHERE "startMin" < 0;
UPDATE "working_schedule_line" SET "endMin" = 24 * 60 WHERE "endMin" > 24 * 60;
UPDATE "working_schedule_line" SET "endMin" = "startMin" + 1 WHERE "endMin" <= "startMin";
UPDATE "working_schedule_line" SET "startMin" = "endMin" - 1 WHERE "endMin" > 24 * 60 OR "startMin" >= 24 * 60;
UPDATE "working_schedule_line" SET "endMin" = 24 * 60 WHERE "endMin" > 24 * 60;
UPDATE "working_schedule" SET "hoursPerWeek" = 1 WHERE "hoursPerWeek" <= 0;
UPDATE "working_schedule" SET "daysPerWeek" = 1 WHERE "daysPerWeek" < 1;
UPDATE "working_schedule" SET "daysPerWeek" = 7 WHERE "daysPerWeek" > 7;
UPDATE "time_off_allocation" SET "allocated" = 0 WHERE "allocated" < 0;
UPDATE "time_off_allocation" SET "taken" = 0 WHERE "taken" < 0;
UPDATE "time_off_allocation" SET "taken" = "allocated" WHERE "taken" > "allocated";
UPDATE "payslip" SET "wage" = 0 WHERE "wage" < 0;
UPDATE "payslip" SET "gross" = 0 WHERE "gross" < 0;
UPDATE "performance_goal" SET "progress" = 0 WHERE "progress" < 0;
UPDATE "performance_goal" SET "progress" = 100 WHERE "progress" > 100;

ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_dates_ordered"
  CHECK ("endDate" >= "startDate");

ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_duration_nonneg"
  CHECK ("duration" >= 0);

ALTER TABLE "contract"
  ADD CONSTRAINT "contract_dates_ordered"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "contract"
  ADD CONSTRAINT "contract_wage_nonneg"
  CHECK ("wage" >= 0);

ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_checkout_needs_checkin"
  CHECK ("checkOut" IS NULL OR "checkIn" IS NOT NULL);

ALTER TABLE "working_schedule_line"
  ADD CONSTRAINT "working_schedule_line_weekday"
  CHECK ("weekday" >= 1 AND "weekday" <= 7);

ALTER TABLE "working_schedule_line"
  ADD CONSTRAINT "working_schedule_line_range"
  CHECK ("endMin" > "startMin" AND "startMin" >= 0 AND "endMin" <= 24 * 60);

ALTER TABLE "working_schedule"
  ADD CONSTRAINT "working_schedule_hours_positive"
  CHECK ("hoursPerWeek" > 0 AND "daysPerWeek" BETWEEN 1 AND 7);

ALTER TABLE "time_off_allocation"
  ADD CONSTRAINT "time_off_allocation_amounts"
  CHECK ("allocated" >= 0 AND "taken" >= 0 AND "taken" <= "allocated" + 0.01);

ALTER TABLE "payslip"
  ADD CONSTRAINT "payslip_amounts_nonneg"
  CHECK ("wage" >= 0 AND "gross" >= 0);

ALTER TABLE "performance_goal"
  ADD CONSTRAINT "performance_goal_progress"
  CHECK ("progress" >= 0 AND "progress" <= 100);
