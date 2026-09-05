-- Additive payroll fields that Krishil's payruns need on top of Malay's oxp_domain tables.
ALTER TABLE "employee_profile" ADD COLUMN IF NOT EXISTS "wage" DECIMAL(12,2);
ALTER TABLE "payslip" ADD COLUMN IF NOT EXISTS "wage" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payslip" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
