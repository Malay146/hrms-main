-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('full_time', 'intern', 'contractor');

-- CreateEnum
CREATE TYPE "SalaryCategory" AS ENUM ('basic', 'allowance', 'gross', 'deduction', 'net', 'contribution');

-- CreateEnum
CREATE TYPE "RuleComputation" AS ENUM ('fixed', 'percent_of_wage', 'percent_of_basic', 'percent_of_gross', 'percent_of_category', 'formula');

-- CreateEnum
CREATE TYPE "PayrunStatus" AS ENUM ('draft', 'computed', 'validated', 'paid');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('draft', 'computed', 'validated', 'paid');

-- AlterTable
ALTER TABLE "employee_profile" ADD COLUMN "employeeType" "EmployeeType" NOT NULL DEFAULT 'full_time';
ALTER TABLE "employee_profile" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "employee_profile" ADD COLUMN "wage" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "salary_structure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "salary_structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "payslip" (
    "id" TEXT NOT NULL,
    "payrunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractId" TEXT,
    "workedDays" DECIMAL(6,2) NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'draft',
    "warning" TEXT,
    "wage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

CREATE INDEX "salary_structure_organizationId_idx" ON "salary_structure"("organizationId");
CREATE INDEX "salary_rule_structureId_sequence_idx" ON "salary_rule"("structureId", "sequence");
CREATE INDEX "payrun_organizationId_periodStart_idx" ON "payrun"("organizationId", "periodStart");
CREATE UNIQUE INDEX "payslip_payrunId_employeeId_key" ON "payslip"("payrunId", "employeeId");
CREATE INDEX "payslip_employeeId_idx" ON "payslip"("employeeId");
CREATE INDEX "payslip_line_payslipId_idx" ON "payslip_line"("payslipId");

ALTER TABLE "salary_structure" ADD CONSTRAINT "salary_structure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_rule" ADD CONSTRAINT "salary_rule_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "salary_structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payrun" ADD CONSTRAINT "payrun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payrun" ADD CONSTRAINT "payrun_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "salary_structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_payrunId_fkey" FOREIGN KEY ("payrunId") REFERENCES "payrun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslip" ADD CONSTRAINT "payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslip_line" ADD CONSTRAINT "payslip_line_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
