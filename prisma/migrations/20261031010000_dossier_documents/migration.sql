-- CreateTable
CREATE TABLE "dossier_section" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_document" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "finalVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_version" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_comment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossier_section_dossierId_position_idx" ON "dossier_section"("dossierId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "dossier_document_finalVersionId_key" ON "dossier_document"("finalVersionId");

-- CreateIndex
CREATE INDEX "dossier_document_sectionId_createdAt_idx" ON "dossier_document"("sectionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_documentId_number_key" ON "document_version"("documentId", "number");

-- CreateIndex
CREATE INDEX "document_comment_documentId_createdAt_idx" ON "document_comment"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "dossier_section" ADD CONSTRAINT "dossier_section_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_document" ADD CONSTRAINT "dossier_document_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "dossier_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_document" ADD CONSTRAINT "dossier_document_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_document" ADD CONSTRAINT "dossier_document_finalVersionId_fkey" FOREIGN KEY ("finalVersionId") REFERENCES "document_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "dossier_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "dossier_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

