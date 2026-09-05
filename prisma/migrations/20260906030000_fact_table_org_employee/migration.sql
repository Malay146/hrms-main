-- Stamp organizationId + employeeId (profile.id) on attendance and leave_request.
-- Abort if a fact row has no employee_profile. Keep userId. Deploy with
-- `npx prisma migrate deploy`.

ALTER TABLE "attendance" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "attendance" ADD COLUMN "employeeId" TEXT;

UPDATE "attendance" a
SET "organizationId" = p."organizationId",
    "employeeId" = p.id
FROM "employee_profile" p
WHERE p."userId" = a."userId";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM attendance WHERE "organizationId" IS NULL OR "employeeId" IS NULL) THEN
    RAISE EXCEPTION 'attendance rows missing employee_profile; abort migrate';
  END IF;
END $$;

ALTER TABLE "attendance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "attendance" ALTER COLUMN "employeeId" SET NOT NULL;

ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE;
ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;

CREATE INDEX "attendance_organizationId_date_idx" ON "attendance" ("organizationId", "date");
CREATE INDEX "attendance_employeeId_date_idx" ON "attendance" ("employeeId", "date");

ALTER TABLE "leave_request" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "leave_request" ADD COLUMN "employeeId" TEXT;

UPDATE "leave_request" lr
SET "organizationId" = p."organizationId",
    "employeeId" = p.id
FROM "employee_profile" p
WHERE p."userId" = lr."userId";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM leave_request WHERE "organizationId" IS NULL OR "employeeId" IS NULL) THEN
    RAISE EXCEPTION 'leave_request rows missing employee_profile; abort migrate';
  END IF;
END $$;

ALTER TABLE "leave_request" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "leave_request" ALTER COLUMN "employeeId" SET NOT NULL;

ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employee_profile"("id") ON DELETE CASCADE;
ALTER TABLE "leave_request"
  ADD CONSTRAINT "leave_request_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;

CREATE INDEX "leave_request_organizationId_status_idx" ON "leave_request" ("organizationId", "status");
CREATE INDEX "leave_request_employeeId_idx" ON "leave_request" ("employeeId");

CREATE OR REPLACE FUNCTION attendance_matches_profile() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employee_profile p
    WHERE p.id = NEW."employeeId"
      AND p."userId" = NEW."userId"
      AND p."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'attendance person/org mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_matches_profile ON "attendance";
CREATE TRIGGER attendance_matches_profile
  BEFORE INSERT OR UPDATE ON "attendance"
  FOR EACH ROW
  EXECUTE FUNCTION attendance_matches_profile();

CREATE OR REPLACE FUNCTION leave_request_matches_profile() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM employee_profile p
    WHERE p.id = NEW."employeeId"
      AND p."userId" = NEW."userId"
      AND p."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'leave_request person/org mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leave_request_matches_profile ON "leave_request";
CREATE TRIGGER leave_request_matches_profile
  BEFORE INSERT OR UPDATE ON "leave_request"
  FOR EACH ROW
  EXECUTE FUNCTION leave_request_matches_profile();
