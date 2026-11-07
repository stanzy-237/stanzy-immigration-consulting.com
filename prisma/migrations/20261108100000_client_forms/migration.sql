-- CreateTable
CREATE TABLE "client_form" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_form_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_form_documentId_key" ON "client_form"("documentId");

-- AddForeignKey
ALTER TABLE "client_form" ADD CONSTRAINT "client_form_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "dossier_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_form" ADD CONSTRAINT "client_form_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

