-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('PENDING', 'SIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SigningAssetKind" AS ENUM ('SIGNATURE', 'STAMP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'SIGNATURE_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'DOCUMENT_SIGNED';

-- CreateTable
CREATE TABLE "signature_request" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "signedVersionId" TEXT,
    "signedById" TEXT,
    "signedName" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedIp" TEXT,
    "signedDevice" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_asset" (
    "kind" "SigningAssetKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_asset_pkey" PRIMARY KEY ("kind")
);

-- CreateIndex
CREATE UNIQUE INDEX "signature_request_signedVersionId_key" ON "signature_request"("signedVersionId");

-- CreateIndex
CREATE INDEX "signature_request_documentId_status_idx" ON "signature_request"("documentId", "status");

-- CreateIndex
CREATE INDEX "signature_request_status_createdAt_idx" ON "signature_request"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "signature_request" ADD CONSTRAINT "signature_request_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "dossier_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_request" ADD CONSTRAINT "signature_request_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "document_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_request" ADD CONSTRAINT "signature_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_request" ADD CONSTRAINT "signature_request_signedVersionId_fkey" FOREIGN KEY ("signedVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_request" ADD CONSTRAINT "signature_request_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

