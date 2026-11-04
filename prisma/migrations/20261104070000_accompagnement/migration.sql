-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InterestLevel" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "StanzyRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'ASSIGNED', 'DECLINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'INTEREST_SUBMITTED';
ALTER TYPE "NotificationKind" ADD VALUE 'INTEREST_REJECTED';
ALTER TYPE "NotificationKind" ADD VALUE 'STANZY_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'STANZY_DECLINED';

-- AlterTable
ALTER TABLE "dossier_document" ADD COLUMN     "clientNote" TEXT,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "missing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "need" TEXT;

-- CreateTable
CREATE TABLE "interest_request" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "InterestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "answers" JSONB NOT NULL,
    "level" "InterestLevel" NOT NULL,
    "levelOverride" "InterestLevel",
    "residence" TEXT NOT NULL,
    "rejectReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "dossierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interest_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stanzy_request" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "StanzyRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "declineNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stanzy_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interest_request_dossierId_key" ON "interest_request"("dossierId");

-- CreateIndex
CREATE INDEX "interest_request_status_createdAt_idx" ON "interest_request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "interest_request_accountId_createdAt_idx" ON "interest_request"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "stanzy_request_documentId_status_idx" ON "stanzy_request"("documentId", "status");

-- CreateIndex
CREATE INDEX "stanzy_request_status_createdAt_idx" ON "stanzy_request"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "interest_request" ADD CONSTRAINT "interest_request_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_request" ADD CONSTRAINT "interest_request_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_request" ADD CONSTRAINT "interest_request_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stanzy_request" ADD CONSTRAINT "stanzy_request_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "dossier_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stanzy_request" ADD CONSTRAINT "stanzy_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

