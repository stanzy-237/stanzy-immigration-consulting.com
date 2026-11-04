-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingFileKind" AS ENUM ('RECORDING', 'TRANSCRIPTION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'MEETING_SCHEDULED';
ALTER TYPE "NotificationKind" ADD VALUE 'MEETING_MOVED';
ALTER TYPE "NotificationKind" ADD VALUE 'MEETING_CANCELLED';
ALTER TYPE "NotificationKind" ADD VALUE 'MEETING_REMINDER';

-- CreateTable
CREATE TABLE "meeting" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "recording" BOOLEAN NOT NULL DEFAULT true,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "plannedById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "remindedDayBefore" TIMESTAMP(3),
    "remindedSoon" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_consent" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_recording" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "kind" "MeetingFileKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "objectKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_dossierId_startsAt_idx" ON "meeting"("dossierId", "startsAt");

-- CreateIndex
CREATE INDEX "meeting_status_startsAt_idx" ON "meeting"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_consent_meetingId_accountId_key" ON "meeting_consent"("meetingId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_recording_meetingId_kind_filename_key" ON "meeting_recording"("meetingId", "kind", "filename");

-- AddForeignKey
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_plannedById_fkey" FOREIGN KEY ("plannedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_consent" ADD CONSTRAINT "meeting_consent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_consent" ADD CONSTRAINT "meeting_consent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recording" ADD CONSTRAINT "meeting_recording_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

