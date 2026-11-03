-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('DOSSIER_OPENED', 'DOSSIER_STAGE_CHANGED', 'DOSSIER_CLOSED', 'DOCUMENT_ADDED', 'VERSION_UPLOADED', 'MESSAGE_POSTED', 'INVOICE_SENT', 'INVOICE_PAID', 'PROOF_RECEIVED');

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "actorId" TEXT,
    "dossierId" TEXT,
    "documentId" TEXT,
    "commentId" TEXT,
    "invoiceId" TEXT,
    "params" JSONB NOT NULL DEFAULT '{}',
    "count" INTEGER NOT NULL DEFAULT 1,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_recipientId_updatedAt_idx" ON "notification"("recipientId", "updatedAt");

-- CreateIndex
CREATE INDEX "notification_recipientId_readAt_idx" ON "notification"("recipientId", "readAt");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "dossier_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "document_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

