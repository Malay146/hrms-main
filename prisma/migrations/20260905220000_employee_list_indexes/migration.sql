-- Employee directory query paths
CREATE INDEX IF NOT EXISTS "employee_profile_organizationId_status_idx" ON "employee_profile"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "employee_profile_organizationId_departmentId_idx" ON "employee_profile"("organizationId", "departmentId");
CREATE INDEX IF NOT EXISTS "employee_profile_organizationId_employeeId_idx" ON "employee_profile"("organizationId", "employeeId");

-- Leave overlap / on-leave-today lookups
CREATE INDEX IF NOT EXISTS "leave_request_status_startDate_endDate_idx" ON "leave_request"("status", "startDate", "endDate");

-- Attendance by user+date (unique already exists; keep explicit for planners)
CREATE INDEX IF NOT EXISTS "attendance_userId_date_idx" ON "attendance"("userId", "date");
