-- Hot list / expire / filter paths
CREATE INDEX IF NOT EXISTS "contract_status_endDate_idx" ON "contract"("status", "endDate");
CREATE INDEX IF NOT EXISTS "contract_employeeId_status_idx" ON "contract"("employeeId", "status");

CREATE INDEX IF NOT EXISTS "time_off_allocation_status_validityYear_idx" ON "time_off_allocation"("status", "validityYear");

CREATE INDEX IF NOT EXISTS "attendance_date_status_idx" ON "attendance"("date", "status");

CREATE INDEX IF NOT EXISTS "payrun_organizationId_periodStart_periodEnd_idx" ON "payrun"("organizationId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "payrun_status_idx" ON "payrun"("status");

CREATE INDEX IF NOT EXISTS "payslip_status_idx" ON "payslip"("status");
CREATE INDEX IF NOT EXISTS "payslip_createdAt_idx" ON "payslip"("createdAt");

CREATE INDEX IF NOT EXISTS "job_opening_organizationId_status_idx" ON "job_opening"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "salary_structure_organizationId_active_idx" ON "salary_structure"("organizationId", "active");
