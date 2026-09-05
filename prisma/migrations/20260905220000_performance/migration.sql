-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('draft', 'submitted', 'acknowledged');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "performance_cycle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_review" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'draft',
    "overallRating" DECIMAL(3,1),
    "summary" TEXT NOT NULL DEFAULT '',
    "employeeComments" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_goal" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_cycle_organizationId_idx" ON "performance_cycle"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "performance_review_cycleId_employeeId_key" ON "performance_review"("cycleId", "employeeId");

-- CreateIndex
CREATE INDEX "performance_review_employeeId_idx" ON "performance_review"("employeeId");

-- CreateIndex
CREATE INDEX "performance_review_reviewerId_idx" ON "performance_review"("reviewerId");

-- CreateIndex
CREATE INDEX "performance_goal_reviewId_idx" ON "performance_goal"("reviewId");

-- AddForeignKey
ALTER TABLE "performance_cycle" ADD CONSTRAINT "performance_cycle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review" ADD CONSTRAINT "performance_review_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "performance_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review" ADD CONSTRAINT "performance_review_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_review" ADD CONSTRAINT "performance_review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "employee_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_goal" ADD CONSTRAINT "performance_goal_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "performance_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
