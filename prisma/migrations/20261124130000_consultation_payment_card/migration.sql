-- DropIndex
DROP INDEX "consultation_payment_checkoutId_key";

-- AlterTable
ALTER TABLE "consultation_payment" DROP COLUMN "checkoutId",
DROP COLUMN "flow",
ADD COLUMN     "settledCurrency" TEXT;

-- DropEnum
DROP TYPE "ConsultationPaymentFlow";

