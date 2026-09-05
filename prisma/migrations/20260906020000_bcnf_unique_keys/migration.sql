-- Deduplicate then add BCNF unique indexes. Keep the oldest row
-- (smallest "createdAt", then smallest id). Deploy with `npx prisma migrate deploy`.

-- Department names unique per org (case-insensitive). Repoint FKs first.
WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", lower("name"))
    id,
    "organizationId",
    lower("name") AS lname
  FROM "department"
  ORDER BY "organizationId", lower("name"), "createdAt" ASC, id ASC
),
dups AS (
  SELECT d.id AS dup_id, k.id AS keep_id
  FROM "department" d
  JOIN keepers k
    ON d."organizationId" = k."organizationId"
   AND lower(d."name") = k.lname
  WHERE d.id <> k.id
)
UPDATE "employee_profile" ep
SET "departmentId" = dups.keep_id
FROM dups
WHERE ep."departmentId" = dups.dup_id;

WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", lower("name"))
    id,
    "organizationId",
    lower("name") AS lname
  FROM "department"
  ORDER BY "organizationId", lower("name"), "createdAt" ASC, id ASC
),
dups AS (
  SELECT d.id AS dup_id, k.id AS keep_id
  FROM "department" d
  JOIN keepers k
    ON d."organizationId" = k."organizationId"
   AND lower(d."name") = k.lname
  WHERE d.id <> k.id
)
UPDATE "contract" c
SET "departmentId" = dups.keep_id
FROM dups
WHERE c."departmentId" = dups.dup_id;

DELETE FROM "department" d
WHERE d.id NOT IN (
  SELECT DISTINCT ON ("organizationId", lower("name")) id
  FROM "department"
  ORDER BY "organizationId", lower("name"), "createdAt" ASC, id ASC
);

-- Salary structure names unique per org (case-insensitive). Repoint FKs first.
WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", lower("name"))
    id,
    "organizationId",
    lower("name") AS lname
  FROM "salary_structure"
  ORDER BY "organizationId", lower("name"), "createdAt" ASC, id ASC
),
dups AS (
  SELECT s.id AS dup_id, k.id AS keep_id
  FROM "salary_structure" s
  JOIN keepers k
    ON s."organizationId" = k."organizationId"
   AND lower(s."name") = k.lname
  WHERE s.id <> k.id
)
UPDATE "salary_rule" r
SET "structureId" = dups.keep_id
FROM dups
WHERE r."structureId" = dups.dup_id;

WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", lower("name"))
    id,
    "organizationId",
    lower("name") AS lname
  FROM "salary_structure"
  ORDER BY "organizationId", lower("name"), "createdAt" ASC, id ASC
),
dups AS (
  SELECT s.id AS dup_id, k.id AS keep_id
  FROM "salary_structure" s
  JOIN keepers k
    ON s."organizationId" = k."organizationId"
   AND lower(s."name") = k.lname
  WHERE s.id <> k.id
)
UPDATE "contract" c
SET "salaryStructureId" = dups.keep_id
FROM dups
WHERE c."salaryStructureId" = dups.dup_id;

WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", lower("name"))
    id,
    "organizationId",
    lower("name") AS lname
  FROM "salary_structure"
  ORDER BY "organizationId", lower("name"), "createdAt" ASC, id ASC
),
dups AS (
  SELECT s.id AS dup_id, k.id AS keep_id
  FROM "salary_structure" s
  JOIN keepers k
    ON s."organizationId" = k."organizationId"
   AND lower(s."name") = k.lname
  WHERE s.id <> k.id
)
UPDATE "payrun" p
SET "structureId" = dups.keep_id
FROM dups
WHERE p."structureId" = dups.dup_id;

DELETE FROM "salary_structure" s
WHERE s.id NOT IN (
  SELECT DISTINCT ON ("organizationId", lower("name")) id
  FROM "salary_structure"
  ORDER BY "organizationId", lower("name"), "createdAt" ASC, id ASC
);

-- Salary rule codes unique per structure. No incoming FKs.
DELETE FROM "salary_rule" r
WHERE r.id NOT IN (
  SELECT DISTINCT ON ("structureId", "code") id
  FROM "salary_rule"
  ORDER BY "structureId", "code", "createdAt" ASC, id ASC
);

-- One schedule line per weekday. No createdAt; keep smallest id.
DELETE FROM "working_schedule_line" w
WHERE w.id NOT IN (
  SELECT DISTINCT ON ("scheduleId", "weekday") id
  FROM "working_schedule_line"
  ORDER BY "scheduleId", "weekday", id ASC
);

-- One allocation per employee / type / year. Repoint leave_request first.
WITH keepers AS (
  SELECT DISTINCT ON ("employeeId", "typeId", "validityYear")
    id,
    "employeeId",
    "typeId",
    "validityYear"
  FROM "time_off_allocation"
  ORDER BY "employeeId", "typeId", "validityYear", "createdAt" ASC, id ASC
),
dups AS (
  SELECT a.id AS dup_id, k.id AS keep_id
  FROM "time_off_allocation" a
  JOIN keepers k
    ON a."employeeId" = k."employeeId"
   AND a."typeId" = k."typeId"
   AND a."validityYear" = k."validityYear"
  WHERE a.id <> k.id
)
UPDATE "leave_request" lr
SET "allocationId" = dups.keep_id
FROM dups
WHERE lr."allocationId" = dups.dup_id;

DELETE FROM "time_off_allocation" a
WHERE a.id NOT IN (
  SELECT DISTINCT ON ("employeeId", "typeId", "validityYear") id
  FROM "time_off_allocation"
  ORDER BY "employeeId", "typeId", "validityYear", "createdAt" ASC, id ASC
);

-- One payrun per org / period / employee type (NULL type coalesced).
-- Drop colliding payslips on the duplicate run, remappoint the rest, then delete.
WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, ''))
    id,
    "organizationId",
    "periodStart",
    "periodEnd",
    COALESCE("employeeType"::text, '') AS typ
  FROM "payrun"
  ORDER BY "organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, ''), "createdAt" ASC, id ASC
),
dups AS (
  SELECT p.id AS dup_id, k.id AS keep_id
  FROM "payrun" p
  JOIN keepers k
    ON p."organizationId" = k."organizationId"
   AND p."periodStart" = k."periodStart"
   AND p."periodEnd" = k."periodEnd"
   AND COALESCE(p."employeeType"::text, '') = k.typ
  WHERE p.id <> k.id
)
DELETE FROM "payslip" slip
USING dups
WHERE slip."payrunId" = dups.dup_id
  AND EXISTS (
    SELECT 1
    FROM "payslip" kept
    WHERE kept."payrunId" = dups.keep_id
      AND kept."employeeId" = slip."employeeId"
  );

WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, ''))
    id,
    "organizationId",
    "periodStart",
    "periodEnd",
    COALESCE("employeeType"::text, '') AS typ
  FROM "payrun"
  ORDER BY "organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, ''), "createdAt" ASC, id ASC
),
dups AS (
  SELECT p.id AS dup_id, k.id AS keep_id
  FROM "payrun" p
  JOIN keepers k
    ON p."organizationId" = k."organizationId"
   AND p."periodStart" = k."periodStart"
   AND p."periodEnd" = k."periodEnd"
   AND COALESCE(p."employeeType"::text, '') = k.typ
  WHERE p.id <> k.id
)
UPDATE "payslip" slip
SET "payrunId" = dups.keep_id
FROM dups
WHERE slip."payrunId" = dups.dup_id;

DELETE FROM "payrun" p
WHERE p.id NOT IN (
  SELECT DISTINCT ON ("organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, '')) id
  FROM "payrun"
  ORDER BY "organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, ''), "createdAt" ASC, id ASC
);

-- Idempotent recreate after a partial deploy (enum→text unique is not IMMUTABLE).
DROP INDEX IF EXISTS "department_organizationId_lower_name_key";
DROP INDEX IF EXISTS "working_schedule_line_scheduleId_weekday_key";
DROP INDEX IF EXISTS "salary_rule_structureId_code_key";
DROP INDEX IF EXISTS "time_off_allocation_employee_type_year_key";
DROP INDEX IF EXISTS "payrun_org_period_type_key";
DROP INDEX IF EXISTS "salary_structure_organizationId_name_key";
DROP INDEX IF EXISTS "employee_profile_organizationId_employeeId_key";

-- Department names unique per org (case-insensitive) — SQL-only
CREATE UNIQUE INDEX "department_organizationId_lower_name_key"
  ON "department" ("organizationId", lower("name"));

CREATE UNIQUE INDEX "working_schedule_line_scheduleId_weekday_key" ON "working_schedule_line" ("scheduleId", "weekday");

CREATE UNIQUE INDEX "salary_rule_structureId_code_key"
  ON "salary_rule" ("structureId", "code");

CREATE UNIQUE INDEX "time_off_allocation_employee_type_year_key" ON "time_off_allocation" ("employeeId", "typeId", "validityYear");

-- Enum → text is STABLE in Postgres; an IMMUTABLE wrapper lets COALESCE live in a unique index.
CREATE OR REPLACE FUNCTION bcnf_employee_type_text(t "EmployeeType")
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT t::text; $$;

CREATE UNIQUE INDEX "payrun_org_period_type_key"
  ON "payrun" ("organizationId", "periodStart", "periodEnd", (COALESCE(bcnf_employee_type_text("employeeType"), '')));

CREATE UNIQUE INDEX "salary_structure_organizationId_name_key"
  ON "salary_structure" ("organizationId", lower("name"));

-- Employee IDs unique per org (was globally unique).
DROP INDEX IF EXISTS "employee_profile_employeeId_key";
CREATE UNIQUE INDEX "employee_profile_organizationId_employeeId_key"
  ON "employee_profile" ("organizationId", "employeeId");
