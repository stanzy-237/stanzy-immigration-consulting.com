-- AlterTable
ALTER TABLE "dossier" ADD COLUMN     "partnerShare" INTEGER,
ADD COLUMN     "servicePrice" INTEGER;

-- AlterTable
ALTER TABLE "document_service" ADD COLUMN     "partnerShare" INTEGER;
