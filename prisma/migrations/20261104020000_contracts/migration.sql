-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('SENT', 'SIGNED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'CONTRACT_SENT';
ALTER TYPE "NotificationKind" ADD VALUE 'CONTRACT_SIGNED';

-- CreateTable
CREATE TABLE "contract_template" (
    "id" TEXT NOT NULL,
    "service" "ServiceType" NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_counter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "contract_counter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "parentId" TEXT,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "amount" INTEGER,
    "currency" "InvoiceCurrency",
    "schedule" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'SENT',
    "objectKey" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "signedObjectKey" TEXT,
    "signedWrappedKey" TEXT,
    "signedIv" TEXT,
    "signedSize" INTEGER,
    "signedById" TEXT,
    "signedName" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedIp" TEXT,
    "signedDevice" TEXT,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_template_service_locale_key" ON "contract_template"("service", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "contract_number_key" ON "contract"("number");

-- CreateIndex
CREATE INDEX "contract_dossierId_sentAt_idx" ON "contract"("dossierId", "sentAt");

-- CreateIndex
CREATE INDEX "contract_status_sentAt_idx" ON "contract"("status", "sentAt");

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

