-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DOSSIER_MESSAGE';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "messageId" TEXT;

-- CreateTable
CREATE TABLE "dossier_message" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_message_file" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_message_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossier_message_dossierId_createdAt_idx" ON "dossier_message"("dossierId", "createdAt");

-- CreateIndex
CREATE INDEX "dossier_message_parentId_idx" ON "dossier_message"("parentId");

-- CreateIndex
CREATE INDEX "dossier_message_file_messageId_idx" ON "dossier_message_file"("messageId");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "dossier_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_message" ADD CONSTRAINT "dossier_message_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_message" ADD CONSTRAINT "dossier_message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "dossier_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_message" ADD CONSTRAINT "dossier_message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_message_file" ADD CONSTRAINT "dossier_message_file_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "dossier_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

