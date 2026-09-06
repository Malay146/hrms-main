-- Reject newer approved leaves that overlap an older approved leave for the
-- same employee (createdAt, then id). Do not delete leave or payroll rows.
-- Deploy with `npx prisma migrate deploy`.
--
-- CREATE EXTENSION btree_gist needs CREATE privilege (superuser on local
-- PeoplePay360). Hosted roles may need the extension created by an admin
-- before this migration can add the gist exclusion.

-- Preview overlapping approved pairs (run manually if migrate aborts):
-- SELECT a.id AS older_id, b.id AS newer_id, a."employeeId",
--        a."startDate", a."endDate", b."startDate", b."endDate"
-- FROM "leave_request" a
-- JOIN "leave_request" b
--   ON a."employeeId" = b."employeeId"
--  AND a.id <> b.id
--  AND a.status = 'approved'
--  AND b.status = 'approved'
--  AND a."startDate" <= b."endDate"
--  AND a."endDate" >= b."startDate"
--  AND (
--    a."createdAt" < b."createdAt"
--    OR (a."createdAt" = b."createdAt" AND a.id < b.id)
--  );

-- One pass covers 3+ overlapping rows: any approved row that overlaps an
-- older approved row for the same employee is rejected (not only pairwise
-- newest-of-two).
UPDATE "leave_request" newer
SET
  status = 'rejected',
  "adminComment" = 'Rejected: overlapping approved leave (constraint migration)'
FROM "leave_request" older
WHERE newer.status = 'approved'
  AND older.status = 'approved'
  AND newer."employeeId" = older."employeeId"
  AND newer.id <> older.id
  AND newer."startDate" <= older."endDate"
  AND newer."endDate" >= older."startDate"
  AND (
    older."createdAt" < newer."createdAt"
    OR (older."createdAt" = newer."createdAt" AND older.id < newer.id)
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "leave_request" a
    JOIN "leave_request" b
      ON a."employeeId" = b."employeeId"
     AND a.id < b.id
     AND a.status = 'approved'
     AND b.status = 'approved'
     AND a."startDate" <= b."endDate"
     AND a."endDate" >= b."startDate"
  ) THEN
    RAISE EXCEPTION 'approved leave ranges still overlap after repair; migrate must abort';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_no_approved_overlap"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  )
  WHERE (status = 'approved');
