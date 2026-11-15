-- AlterTable
ALTER TABLE "interest_request" ADD COLUMN     "answersEditedAt" TIMESTAMP(3),
ADD COLUMN     "answersEditedById" TEXT,
ADD COLUMN     "originalAnswers" JSONB;

-- AddForeignKey
ALTER TABLE "interest_request" ADD CONSTRAINT "interest_request_answersEditedById_fkey" FOREIGN KEY ("answersEditedById") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

