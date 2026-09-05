-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('full_time', 'intern', 'contractor');
CREATE TYPE "ContractStatus" AS ENUM ('running', 'expired');
CREATE TYPE "CalendarType" AS ENUM ('fixed', 'variable');
CREATE TYPE "TimeOffUnit" AS ENUM ('days', 'hours');
CREATE TYPE "TimeOffApprover" AS ENUM ('manager', 'officer');
CREATE TYPE "AllocationStatus" AS ENUM ('draft', 'approved', 'refused');
CREATE TYPE "SalaryCategory" AS ENUM ('basic', 'allowance', 'gross', 'deduction', 'net', 'contribution');
CREATE TYPE "RuleComputation" AS ENUM ('fixed', 'percent_of_wage', 'percent_of_basic', 'percent_of_gross', 'percent_of_category', 'formula');
CREATE TYPE "PayrunStatus" AS ENUM ('draft', 'computed', 'validated', 'paid');
CREATE TYPE "PayslipStatus" AS ENUM ('draft', 'computed', 'validated', 'paid');

-- Department
CREATE TABLE "department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "department_organizationId_code_key" ON "department"("organizationId", "code");
CREATE INDEX "department_organizationId_idx" ON "department"("organizationId");

ALTER TABLE "department"
  ADD CONSTRAINT "department_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Working schedules
CREATE TABLE "working_schedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calendarType" "CalendarType" NOT NULL DEFAULT 'fixed',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hoursPerWeek" DECIMAL(6,2) NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "working_schedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "working_schedule_organizationId_idx" ON "working_schedule"("organizationId");
ALTER TABLE "working_schedule"
  ADD CONSTRAINT "working_schedule_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "working_schedule_line" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "breakMin" INTEGER NOT NULL DEFAULT 60,
    "hours" DECIMAL(4,2) NOT NULL,
    CONSTRAINT "working_schedule_line_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "working_schedule_line_scheduleId_idx" ON "working_schedule_line"("scheduleId");
ALTER TABLE "working_schedule_line"
  ADD CONSTRAINT "working_schedule_line_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "working_schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill departments from existing profile strings
INSERT INTO "department" ("id", "organizationId", "name", "code", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || ep."department") AS "id",
  ep."organizationId",
  ep."department",
  upper(regexp_replace(regexp_replace(ep."department", '[^A-Za-z0-9]+', '_', 'g'), '^_|_$', '', 'g')),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "organizationId", "department"
  FROM "employee_profile"
) ep;

-- EmployeeProfile: department String → departmentId + new fields
ALTER TABLE "employee_profile" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "managerId" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "scheduleId" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "employeeType" "EmployeeType" NOT NULL DEFAULT 'full_time';
ALTER TABLE "employee_profile" ADD COLUMN "workLocation" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "companyName" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "personalEmail" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "address" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "joinDate" DATE;

UPDATE "employee_profile" ep
SET "departmentId" = d."id"
FROM "department" d
WHERE d."organizationId" = ep."organizationId"
  AND d."name" = ep."department";

ALTER TABLE "employee_profile" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "employee_profile" DROP COLUMN "department";

CREATE INDEX "employee_profile_departmentId_idx" ON "employee_profile"("departmentId");
CREATE INDEX "employee_profile_scheduleId_idx" ON "employee_profile"("scheduleId");
CREATE INDEX "employee_profile_managerId_idx" ON "employee_profile"("managerId");

ALTER TABLE "employee_profile"
  ADD CONSTRAINT "employee_profile_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_profile"
  ADD CONSTRAINT "employee_profile_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "employee_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_profile"
  ADD CONSTRAINT "employee_profile_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "working_schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Salary structures (needed before contracts FK)
CREATE TABLE "salary_structure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "salary_structure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "salary_structure_organizationId_idx" ON "salary_structure"("organizationId");
ALTER TABLE "salary_structure"
  ADD CONSTRAINT "salary_structure_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "salary_rule" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "SalaryCategory" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "computation" "RuleComputation" NOT NULL,
    "amount" DECIMAL(12,2),
    "percentage" DECIMAL(8,4),
    "percentBaseCode" TEXT,
    "formula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "salary_rule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "salary_rule_structureId_idx" ON "salary_rule"("structureId");
ALTER TABLE "salary_rule"
  ADD CONSTRAINT "salary_rule_structureId_fkey"
  FOREIGN KEY ("structureId") REFERENCES "salary_structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contracts
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "scheduleId" TEXT,
    "salaryStructureId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "wage" DECIMAL(12,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "ContractStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_code_key" ON "contract"("code");
CREATE INDEX "contract_employeeId_idx" ON "contract"("employeeId");
CREATE INDEX "contract_departmentId_idx" ON "contract"("departmentId");
CREATE INDEX "contract_scheduleId_idx" ON "contract"("scheduleId");
CREATE INDEX "contract_salaryStructureId_idx" ON "contract"("salaryStructureId");

ALTER TABLE "contract"
  ADD CONSTRAINT "contract_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contract"
  ADD CONSTRAINT "contract_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"
  ADD CONSTRAINT "contract_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "working_schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract"
  ADD CONSTRAINT "contract_salaryStructureId_fkey"
  FOREIGN KEY ("salaryStructureId") REFERENCES "salary_structure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Time off
CREATE TABLE "time_off_type" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" "TimeOffUnit" NOT NULL DEFAULT 'days',
    "requiresAllocation" BOOLEAN NOT NULL DEFAULT true,
    "approver" "TimeOffApprover" NOT NULL DEFAULT 'manager',
    "color" TEXT NOT NULL DEFAULT 'zinc',
    "payrollNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "time_off_type_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "time_off_type_organizationId_code_key" ON "time_off_type"("organizationId", "code");
CREATE INDEX "time_off_type_organizationId_idx" ON "time_off_type"("organizationId");
ALTER TABLE "time_off_type"
  ADD CONSTRAINT "time_off_type_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "time_off_allocation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "allocated" DECIMAL(8,2) NOT NULL,
    "taken" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "validityYear" INTEGER NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "time_off_allocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "time_off_allocation_employeeId_idx" ON "time_off_allocation"("employeeId");
CREATE INDEX "time_off_allocation_typeId_idx" ON "time_off_allocation"("typeId");
ALTER TABLE "time_off_allocation"
  ADD CONSTRAINT "time_off_allocation_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_off_allocation"
  ADD CONSTRAINT "time_off_allocation_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "time_off_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default time-off types per org for leave backfill
INSERT INTO "time_off_type" ("id", "organizationId", "name", "code", "unit", "requiresAllocation", "approver", "color", "createdAt", "updatedAt")
SELECT md5(random()::text || o.id || 'paid'), o.id, 'Paid Time Off', 'paid', 'days', true, 'manager', 'zinc', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organization" o;
INSERT INTO "time_off_type" ("id", "organizationId", "name", "code", "unit", "requiresAllocation", "approver", "color", "createdAt", "updatedAt")
SELECT md5(random()::text || o.id || 'sick'), o.id, 'Sick Leave', 'sick', 'days', true, 'manager', 'zinc', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organization" o;
INSERT INTO "time_off_type" ("id", "organizationId", "name", "code", "unit", "requiresAllocation", "approver", "color", "createdAt", "updatedAt")
SELECT md5(random()::text || o.id || 'unpaid'), o.id, 'Unpaid Leave', 'unpaid', 'days', true, 'manager', 'zinc', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organization" o;
INSERT INTO "time_off_type" ("id", "organizationId", "name", "code", "unit", "requiresAllocation", "approver", "color", "createdAt", "updatedAt")
SELECT md5(random()::text || o.id || 'comp'), o.id, 'Comp Off', 'comp_off', 'days', false, 'manager', 'zinc', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "organization" o;

-- LeaveRequest: type enum → typeId + duration
ALTER TABLE "leave_request" ADD COLUMN "typeId" TEXT;
ALTER TABLE "leave_request" ADD COLUMN "allocationId" TEXT;
ALTER TABLE "leave_request" ADD COLUMN "duration" DECIMAL(8,2);

UPDATE "leave_request" lr
SET
  "typeId" = tot."id",
  "duration" = GREATEST(1, (lr."endDate"::date - lr."startDate"::date) + 1)
FROM "user" u
JOIN "employee_profile" ep ON ep."userId" = u.id
JOIN "time_off_type" tot ON tot."organizationId" = ep."organizationId"
WHERE lr."userId" = u.id
  AND tot."code" = lr."type"::text;

ALTER TABLE "leave_request" ALTER COLUMN "typeId" SET NOT NULL;
ALTER TABLE "leave_request" ALTER COLUMN "duration" SET NOT NULL;
ALTER TABLE "leave_request" DROP COLUMN "type";

CREATE INDEX "leave_request_typeId_idx" ON "leave_request"("typeId");
CREATE INDEX "leave_request_allocationId_idx" ON "leave_request"("allocationId");
ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "time_off_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_allocationId_fkey"
  FOREIGN KEY ("allocationId") REFERENCES "time_off_allocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TYPE IF EXISTS "LeaveType";

-- Attendance extras
ALTER TABLE "attendance" ADD COLUMN "workedHours" DECIMAL(6,2);
ALTER TABLE "attendance" ADD COLUMN "overtimeHours" DECIMAL(6,2);
ALTER TABLE "attendance" ADD COLUMN "notes" TEXT;
ALTER TABLE "attendance" ADD COLUMN "manualEdit" BOOLEAN NOT NULL DEFAULT false;

-- Payruns / payslips
CREATE TABLE "payrun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "employeeType" "EmployeeType",
    "status" "PayrunStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payrun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payrun_organizationId_idx" ON "payrun"("organizationId");
CREATE INDEX "payrun_structureId_idx" ON "payrun"("structureId");
ALTER TABLE "payrun"
  ADD CONSTRAINT "payrun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payrun"
  ADD CONSTRAINT "payrun_structureId_fkey"
  FOREIGN KEY ("structureId") REFERENCES "salary_structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payslip" (
    "id" TEXT NOT NULL,
    "payrunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractId" TEXT,
    "workedDays" DECIMAL(6,2) NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'draft',
    "warning" TEXT,
    "gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payslip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payslip_payrunId_employeeId_key" ON "payslip"("payrunId", "employeeId");
CREATE INDEX "payslip_employeeId_idx" ON "payslip"("employeeId");
CREATE INDEX "payslip_contractId_idx" ON "payslip"("contractId");
ALTER TABLE "payslip"
  ADD CONSTRAINT "payslip_payrunId_fkey"
  FOREIGN KEY ("payrunId") REFERENCES "payrun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslip"
  ADD CONSTRAINT "payslip_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslip"
  ADD CONSTRAINT "payslip_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payslip_line" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "ruleId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "SalaryCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "payslip_line_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payslip_line_payslipId_idx" ON "payslip_line"("payslipId");
ALTER TABLE "payslip_line"
  ADD CONSTRAINT "payslip_line_payslipId_fkey"
  FOREIGN KEY ("payslipId") REFERENCES "payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
