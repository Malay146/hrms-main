-- Enums may already exist from a partial prior apply.
DO $$ BEGIN
  CREATE TYPE "JobOpeningStatus" AS ENUM ('active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CandidateStage" AS ENUM ('applied', 'screening', 'interview', 'technical', 'offer', 'hired', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_opening" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "deadline" DATE NOT NULL,
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_opening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "candidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobOpeningId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "position" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "stage" "CandidateStage" NOT NULL DEFAULT 'applied',
    "rating" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "source" TEXT,
    "appliedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewAt" TIMESTAMP(3),
    "interviewType" TEXT,
    "interviewer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "job_opening_organizationId_idx" ON "job_opening"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "job_opening_organizationId_code_key" ON "job_opening"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "candidate_organizationId_stage_idx" ON "candidate"("organizationId", "stage");
CREATE INDEX IF NOT EXISTS "candidate_jobOpeningId_idx" ON "candidate"("jobOpeningId");
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_organizationId_code_key" ON "candidate"("organizationId", "code");

DO $$ BEGIN
  ALTER TABLE "job_opening" ADD CONSTRAINT "job_opening_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "candidate" ADD CONSTRAINT "candidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "candidate" ADD CONSTRAINT "candidate_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_opening"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
