-- AlterTable
ALTER TABLE "document_comment" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "document_comment_parentId_idx" ON "document_comment"("parentId");

-- AddForeignKey
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "document_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

