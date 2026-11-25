-- AlterTable
ALTER TABLE "consultation_payment" ADD COLUMN     "invoiceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "consultation_payment_invoiceNumber_key" ON "consultation_payment"("invoiceNumber");

