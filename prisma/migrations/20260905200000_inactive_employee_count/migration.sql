-- AlterTable
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "inactiveEmployeeCount" INTEGER NOT NULL DEFAULT 0;
