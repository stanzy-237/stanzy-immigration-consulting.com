-- CreateTable
CREATE TABLE "pdf_compression" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_compression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_compression_accountId_createdAt_idx" ON "pdf_compression"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "pdf_compression" ADD CONSTRAINT "pdf_compression_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

