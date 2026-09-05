-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "BackgroundJobType" AS ENUM ('payrun_compute', 'ai_snapshot_rebuild', 'payslip_bulk_email', 'employee_import_chunk', 'attendance_rollup_backfill');

-- CreateEnum
CREATE TYPE "OrgMetricsKind" AS ENUM ('admin_home', 'payroll_kpis', 'ai_analytics', 'all');

-- CreateTable
CREATE TABLE "attendance_daily_rollup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "halfDayCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "leaveCount" INTEGER NOT NULL DEFAULT 0,
    "lateCount" INTEGER NOT NULL DEFAULT 0,
    "missingCheckoutCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_daily_rollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_metrics_snapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "OrgMetricsKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "sourceJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_metrics_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_job" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "BackgroundJobType" NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'queued',
    "payload" JSONB NOT NULL,
    "progressCurrent" INTEGER,
    "progressTotal" INTEGER,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "background_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_daily_rollup_organizationId_date_key" ON "attendance_daily_rollup"("organizationId", "date");
CREATE INDEX "attendance_daily_rollup_organizationId_date_idx" ON "attendance_daily_rollup"("organizationId", "date");
CREATE INDEX "org_metrics_snapshot_organizationId_kind_generatedAt_idx" ON "org_metrics_snapshot"("organizationId", "kind", "generatedAt");
CREATE INDEX "background_job_organizationId_status_createdAt_idx" ON "background_job"("organizationId", "status", "createdAt");
CREATE INDEX "background_job_status_lockedAt_idx" ON "background_job"("status", "lockedAt");

-- AddForeignKey
ALTER TABLE "attendance_daily_rollup" ADD CONSTRAINT "attendance_daily_rollup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_metrics_snapshot" ADD CONSTRAINT "org_metrics_snapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "background_job" ADD CONSTRAINT "background_job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional search acceleration (Scale S5); safe if extension missing in some envs — use IF NOT EXISTS
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "employee_profile_fullName_trgm_idx" ON "employee_profile" USING gin ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "employee_profile_employeeId_trgm_idx" ON "employee_profile" USING gin ("employeeId" gin_trgm_ops);
