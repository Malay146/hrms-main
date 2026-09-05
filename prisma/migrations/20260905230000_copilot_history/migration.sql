-- CreateTable
CREATE TABLE "copilot_message" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_message_userId_createdAt_idx" ON "copilot_message"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "copilot_message" ADD CONSTRAINT "copilot_message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
