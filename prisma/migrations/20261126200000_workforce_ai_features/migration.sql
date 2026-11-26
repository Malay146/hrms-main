CREATE TABLE "employee_skill" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "proficiency" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_skill_requirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "targetLevel" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_skill_requirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_skill_employeeId_name_key" ON "employee_skill"("employeeId", "name");
CREATE INDEX "employee_skill_employeeId_idx" ON "employee_skill"("employeeId");
CREATE UNIQUE INDEX "role_skill_requirement_organizationId_jobTitle_skillName_key" ON "role_skill_requirement"("organizationId", "jobTitle", "skillName");
CREATE INDEX "role_skill_requirement_organizationId_jobTitle_idx" ON "role_skill_requirement"("organizationId", "jobTitle");

ALTER TABLE "employee_skill" ADD CONSTRAINT "employee_skill_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_skill_requirement" ADD CONSTRAINT "role_skill_requirement_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
