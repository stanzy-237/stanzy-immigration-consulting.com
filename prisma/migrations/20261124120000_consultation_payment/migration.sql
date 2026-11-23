-- CreateEnum
CREATE TYPE "ConsultationPaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsultationPaymentFlow" AS ENUM ('SOFTPAY', 'CHECKOUT');

-- AlterTable
ALTER TABLE "consultation" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT;

-- CreateTable
CREATE TABLE "consultation_payment" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "flow" "ConsultationPaymentFlow" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "transactionId" TEXT,
    "checkoutId" TEXT,
    "checkoutUrl" TEXT,
    "country" TEXT NOT NULL,
    "network" TEXT,
    "networkName" TEXT,
    "phone" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "fee" DECIMAL(12,2),
    "charged" DECIMAL(12,2),
    "netAmount" DECIMAL(12,2),
    "status" "ConsultationPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "failureCode" TEXT,
    "checkedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultation_payment_idempotencyKey_key" ON "consultation_payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_payment_transactionId_key" ON "consultation_payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_payment_checkoutId_key" ON "consultation_payment"("checkoutId");

-- CreateIndex
CREATE INDEX "consultation_payment_consultationId_createdAt_idx" ON "consultation_payment"("consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "consultation_payment_status_createdAt_idx" ON "consultation_payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_paidById_key" ON "consultation"("paidById");

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "consultation_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_payment" ADD CONSTRAINT "consultation_payment_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

