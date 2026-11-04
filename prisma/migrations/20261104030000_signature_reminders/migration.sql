-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'SIGNATURE_REMINDER';
ALTER TYPE "NotificationKind" ADD VALUE 'CONTRACT_REMINDER';

-- AlterTable
ALTER TABLE "signature_request" ADD COLUMN     "reminders" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "contract" ADD COLUMN     "reminders" INTEGER NOT NULL DEFAULT 0;

