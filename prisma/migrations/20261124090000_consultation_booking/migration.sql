-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('HELD', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "consultation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'HELD',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "heldUntil" TIMESTAMP(3),
    "holdTokenHash" TEXT,
    "country" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappReminders" BOOLEAN NOT NULL DEFAULT true,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crsScore" INTEGER,
    "itaReceived" BOOLEAN,
    "situation" TEXT,
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultation_holdTokenHash_key" ON "consultation"("holdTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_meetingId_key" ON "consultation"("meetingId");

-- CreateIndex
CREATE INDEX "consultation_status_startsAt_idx" ON "consultation"("status", "startsAt");

-- CreateIndex
CREATE INDEX "consultation_accountId_createdAt_idx" ON "consultation"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

