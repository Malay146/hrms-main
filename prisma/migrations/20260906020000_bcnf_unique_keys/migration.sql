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

-- One allocation per employee / type / year. Fold balances onto the oldest row.
WITH keepers AS (
  SELECT DISTINCT ON ("employeeId", "typeId", "validityYear")
    id,
    "employeeId",
    "typeId",
    "validityYear"
  FROM "time_off_allocation"
  ORDER BY "employeeId", "typeId", "validityYear", "createdAt" ASC, id ASC
),
totals AS (
  SELECT
    k.id AS keep_id,
    SUM(a.allocated) AS allocated,
    SUM(a.taken) AS taken
  FROM "time_off_allocation" a
  JOIN keepers k
    ON a."employeeId" = k."employeeId"
   AND a."typeId" = k."typeId"
   AND a."validityYear" = k."validityYear"
  GROUP BY k.id
)
UPDATE "time_off_allocation" keeper
SET
  allocated = totals.allocated,
  taken = LEAST(totals.taken, totals.allocated)
FROM totals
WHERE keeper.id = totals.keep_id;

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
-- Keeper is highest status (paid > validated > computed > draft), then oldest.
-- Abort if a group has more than one paid/validated run, or if a collision
-- would delete a paid/validated payslip.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "payrun"
    GROUP BY "organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, '')
    HAVING COUNT(*) FILTER (WHERE status IN ('paid', 'validated')) > 1
  ) THEN
    RAISE EXCEPTION 'cannot collapse payruns: more than one paid or validated run in the same org/period/type';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "payslip" s
    JOIN "payrun" p ON p.id = s."payrunId"
    GROUP BY p."organizationId", p."periodStart", p."periodEnd", COALESCE(p."employeeType"::text, ''), s."employeeId"
    HAVING COUNT(*) FILTER (WHERE s.status IN ('paid', 'validated')) > 1
  ) THEN
    RAISE EXCEPTION 'cannot collapse payruns: would delete a paid or validated payslip';
  END IF;
END $$;

WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, ''))
    id,
    "organizationId",
    "periodStart",
    "periodEnd",
    COALESCE("employeeType"::text, '') AS typ
  FROM "payrun"
  ORDER BY
    "organizationId",
    "periodStart",
    "periodEnd",
    COALESCE("employeeType"::text, ''),
    CASE status
      WHEN 'paid' THEN 0
      WHEN 'validated' THEN 1
      WHEN 'computed' THEN 2
      ELSE 3
    END,
    "createdAt" ASC,
    id ASC
),
group_runs AS (
  SELECT p.id AS run_id, k.id AS keep_id
  FROM "payrun" p
  JOIN keepers k
    ON p."organizationId" = k."organizationId"
   AND p."periodStart" = k."periodStart"
   AND p."periodEnd" = k."periodEnd"
   AND COALESCE(p."employeeType"::text, '') = k.typ
),
ranked AS (
  SELECT
    s.id,
    ROW_NUMBER() OVER (
      PARTITION BY g.keep_id, s."employeeId"
      ORDER BY
        CASE WHEN s.status IN ('paid', 'validated') THEN 0 ELSE 1 END,
        CASE WHEN s."payrunId" = g.keep_id THEN 0 ELSE 1 END,
        s."createdAt" ASC,
        s.id ASC
    ) AS rn
  FROM "payslip" s
  JOIN group_runs g ON g.run_id = s."payrunId"
)
DELETE FROM "payslip" s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1
  AND s.status NOT IN ('paid', 'validated');

WITH keepers AS (
  SELECT DISTINCT ON ("organizationId", "periodStart", "periodEnd", COALESCE("employeeType"::text, ''))
    id,
    "organizationId",
    "periodStart",
    "periodEnd",
    COALESCE("employeeType"::text, '') AS typ
  FROM "payrun"
  ORDER BY
    "organizationId",
    "periodStart",
    "periodEnd",
    COALESCE("employeeType"::text, ''),
    CASE status
      WHEN 'paid' THEN 0
      WHEN 'validated' THEN 1
      WHEN 'computed' THEN 2
      ELSE 3
    END,
    "createdAt" ASC,
    id ASC
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
  ORDER BY
    "organizationId",
    "periodStart",
    "periodEnd",
    COALESCE("employeeType"::text, ''),
    CASE status
      WHEN 'paid' THEN 0
      WHEN 'validated' THEN 1
      WHEN 'computed' THEN 2
      ELSE 3
    END,
    "createdAt" ASC,
    id ASC
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
