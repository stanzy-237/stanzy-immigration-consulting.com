-- Paiements and their Reconnaissance de réception de fonds (#145).

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'BANK_DEPOSIT', 'MOBILE_MONEY', 'CHEQUE', 'OTHER');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'RECEIPT_SENT';
ALTER TYPE "NotificationKind" ADD VALUE 'RECEIPT_SIGNED';

-- AlterTable
ALTER TABLE "payment_proof" ADD COLUMN     "paymentId" TEXT;

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "receivedOn" TEXT NOT NULL,
    "method" "PaymentMethod",
    "methodNote" TEXT,
    "recordedById" TEXT,
    "receiptNumber" TEXT,
    "locale" TEXT,
    "objectKey" TEXT,
    "wrappedKey" TEXT,
    "iv" TEXT,
    "size" INTEGER,
    "fingerprint" TEXT,
    "fields" JSONB,
    "signedObjectKey" TEXT,
    "signedWrappedKey" TEXT,
    "signedIv" TEXT,
    "signedSize" INTEGER,
    "signedById" TEXT,
    "signedName" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedIp" TEXT,
    "signedDevice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_counter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "receipt_counter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_receiptNumber_key" ON "payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "payment_invoiceId_createdAt_idx" ON "payment"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_receivedOn_idx" ON "payment"("receivedOn");

-- AddForeignKey
ALTER TABLE "payment_proof" ADD CONSTRAINT "payment_proof_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Every Facture already paid (« Marquer payée », before #145) gets one Paiement for its total, on the day it was
-- marked paid in Douala, without a Reconnaissance: Finances counts Recettes from Paiements only from now on.
INSERT INTO "payment" ("id", "invoiceId", "amount", "receivedOn", "createdAt")
SELECT 'pay_' || i."id",
       i."id",
       COALESCE(SUM(l."quantity" * l."unitAmount"), 0),
       to_char((i."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Douala', 'YYYY-MM-DD'),
       i."paidAt"
FROM "invoice" i
LEFT JOIN "invoice_line" l ON l."invoiceId" = i."id"
WHERE i."status" = 'PAID' AND i."paidAt" IS NOT NULL
GROUP BY i."id";
