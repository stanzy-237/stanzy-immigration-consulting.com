-- CreateTable
CREATE TABLE "pdf_tool_file" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "changes" TEXT[],
    "quality" DOUBLE PRECISION,
    "sourceNames" TEXT[],
    "objectKey" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_tool_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_tool_file_createdById_createdAt_idx" ON "pdf_tool_file"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "pdf_tool_file" ADD CONSTRAINT "pdf_tool_file_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

