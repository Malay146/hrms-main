-- CreateTable
CREATE TABLE "copilot_conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_conversation_userId_updatedAt_idx" ON "copilot_conversation"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "copilot_conversation" ADD CONSTRAINT "copilot_conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "copilot_message" ADD COLUMN "conversationId" TEXT;

-- Backfill one conversation per user who already has messages
INSERT INTO "copilot_conversation" ("id", "userId", "title", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", 'Earlier chat', MIN("createdAt"), MAX("createdAt")
FROM "copilot_message"
GROUP BY "userId";

UPDATE "copilot_message" AS m
SET "conversationId" = c."id"
FROM "copilot_conversation" AS c
WHERE m."userId" = c."userId";

DELETE FROM "copilot_message" WHERE "conversationId" IS NULL;

ALTER TABLE "copilot_message" ALTER COLUMN "conversationId" SET NOT NULL;

ALTER TABLE "copilot_message" ADD CONSTRAINT "copilot_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "copilot_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "copilot_message_conversationId_createdAt_idx" ON "copilot_message"("conversationId", "createdAt");
