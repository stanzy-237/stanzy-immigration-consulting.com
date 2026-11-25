-- CreateEnum
CREATE TYPE "PromoReduction" AS ENUM ('PERCENT', 'AMOUNT');

-- AlterTable
ALTER TABLE "consultation" ADD COLUMN     "promoCodeId" TEXT;

-- AlterTable
ALTER TABLE "consultation_payment" ADD COLUMN     "discount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promoCodeId" TEXT;

-- CreateTable
CREATE TABLE "promo_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "reductionType" "PromoReduction" NOT NULL,
    "reductionValue" INTEGER NOT NULL,
    "services" TEXT[],
    "places" INTEGER,
    "endsAt" TIMESTAMP(3),
    "oncePerAccount" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promo_code_code_idx" ON "promo_code"("code");

-- CreateIndex
CREATE INDEX "consultation_payment_promoCodeId_status_idx" ON "consultation_payment"("promoCodeId", "status");

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_payment" ADD CONSTRAINT "consultation_payment_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One live code per text: a deleted code frees its text for a new one.
CREATE UNIQUE INDEX "promo_code_live_code_key" ON "promo_code"("code") WHERE "deletedAt" IS NULL;
