-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DRAW_PUBLISHED';

-- AlterTable
ALTER TABLE "push_subscription" ADD COLUMN     "drawAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifications" BOOLEAN NOT NULL DEFAULT false;

