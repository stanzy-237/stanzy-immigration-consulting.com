-- AlterTable
ALTER TABLE "document_service" ADD COLUMN     "handoffTemplate" JSONB,
ADD COLUMN     "partnerEmail" TEXT,
ADD COLUMN     "partnerName" TEXT,
ADD COLUMN     "partnerPhone" TEXT;

-- AlterTable
ALTER TABLE "stanzy_request" ADD COLUMN     "handoffNote" JSONB,
ADD COLUMN     "handoffSentAt" TIMESTAMP(3),
ADD COLUMN     "handoffSentTo" TEXT;

