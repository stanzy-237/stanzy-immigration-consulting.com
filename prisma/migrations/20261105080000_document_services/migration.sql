-- CreateEnum
CREATE TYPE "PriceKind" AS ENUM ('FIXED', 'PERCENT');

-- AlterTable
ALTER TABLE "contract" ADD COLUMN     "stanzyRequestId" TEXT;

-- AlterTable
ALTER TABLE "stanzy_request" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "serviceId" TEXT;

-- CreateTable
CREATE TABLE "document_service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "name" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "provides" JSONB NOT NULL,
    "turnaround" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "contractTitle" JSONB NOT NULL,
    "contractBody" JSONB NOT NULL,
    "priceKind" "PriceKind" NOT NULL,
    "price" INTEGER NOT NULL,
    "unit" JSONB NOT NULL,
    "documentKinds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_service_slug_key" ON "document_service"("slug");

-- CreateIndex
CREATE INDEX "document_service_active_position_idx" ON "document_service"("active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "contract_stanzyRequestId_key" ON "contract"("stanzyRequestId");

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_stanzyRequestId_fkey" FOREIGN KEY ("stanzyRequestId") REFERENCES "stanzy_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stanzy_request" ADD CONSTRAINT "stanzy_request_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "document_service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

