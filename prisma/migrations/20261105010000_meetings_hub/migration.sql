-- CreateEnum
CREATE TYPE "MeetingKind" AS ENUM ('SCHEDULED', 'INSTANT', 'PERSONAL');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'ADMITTED', 'REFUSED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'MEETING_JOIN_REQUEST';

-- AlterTable
ALTER TABLE "meeting" ADD COLUMN     "description" TEXT,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "kind" "MeetingKind" NOT NULL DEFAULT 'SCHEDULED',
ALTER COLUMN "dossierId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "meeting_participant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_join_request" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "meeting_join_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_participant_accountId_idx" ON "meeting_participant"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_participant_meetingId_accountId_key" ON "meeting_participant"("meetingId", "accountId");

-- CreateIndex
CREATE INDEX "meeting_join_request_meetingId_status_idx" ON "meeting_join_request"("meetingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_join_request_meetingId_accountId_key" ON "meeting_join_request"("meetingId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_inviteToken_key" ON "meeting"("inviteToken");

-- AddForeignKey
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_join_request" ADD CONSTRAINT "meeting_join_request_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_join_request" ADD CONSTRAINT "meeting_join_request_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Réunions planned before: a random invitation token each, then required.
UPDATE "meeting" SET "inviteToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE "inviteToken" IS NULL;
ALTER TABLE "meeting" ALTER COLUMN "inviteToken" SET NOT NULL;

-- Their Dossier's Client becomes a participant, as new Réunions have.
INSERT INTO "meeting_participant" ("id", "meetingId", "accountId")
SELECT gen_random_uuid()::text, m."id", d."accountId"
FROM "meeting" m JOIN "dossier" d ON d."id" = m."dossierId"
ON CONFLICT DO NOTHING;

