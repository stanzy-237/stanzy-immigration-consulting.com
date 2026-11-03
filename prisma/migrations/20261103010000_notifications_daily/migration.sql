-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'INVOICE_DUE_SOON';
ALTER TYPE "NotificationKind" ADD VALUE 'INVOICE_OVERDUE';
ALTER TYPE "NotificationKind" ADD VALUE 'INVOICE_LATE';
ALTER TYPE "NotificationKind" ADD VALUE 'ACCOUNTS_SIGNED_UP';

-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "dueSoonRemindedAt" TIMESTAMP(3),
ADD COLUMN     "overdueRemindedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cron_run" (
    "job" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_run_pkey" PRIMARY KEY ("job","day")
);

