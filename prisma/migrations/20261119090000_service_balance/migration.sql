-- AlterTable
ALTER TABLE "dossier" ADD COLUMN     "partnerPrice" INTEGER,
ADD COLUMN     "servicePrice" INTEGER;

-- AlterTable
ALTER TABLE "document_service" ADD COLUMN     "partnerPrice" INTEGER;

-- AlterTable
ALTER TABLE "stanzy_request" ADD COLUMN     "agreedPrice" INTEGER,
ADD COLUMN     "partnerPrice" INTEGER;
