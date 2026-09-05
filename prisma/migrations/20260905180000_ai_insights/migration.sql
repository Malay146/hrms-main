CREATE TABLE "ai_insight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "href" TEXT,
    "payload" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_insight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_insight_organizationId_generatedAt_idx" ON "ai_insight"("organizationId", "generatedAt");

ALTER TABLE "ai_insight" ADD CONSTRAINT "ai_insight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
