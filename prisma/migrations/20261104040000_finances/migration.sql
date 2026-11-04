-- CreateTable
CREATE TABLE "income" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "InvoiceCurrency" NOT NULL,
    "date" DATE NOT NULL,
    "service" "ServiceType",
    "source" TEXT,
    "dossierId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "InvoiceCurrency" NOT NULL,
    "date" DATE NOT NULL,
    "categoryId" TEXT NOT NULL,
    "dossierId" TEXT,
    "note" TEXT,
    "repeatsMonthly" BOOLEAN NOT NULL DEFAULT false,
    "repeatOfId" TEXT,
    "repeatMonth" TEXT,
    "receiptFileName" TEXT,
    "receiptContentType" TEXT,
    "receiptSize" INTEGER,
    "receiptObjectKey" TEXT,
    "receiptWrappedKey" TEXT,
    "receiptIv" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_rate" (
    "month" TEXT NOT NULL,
    "xafPerCad" DECIMAL(12,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_rate_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE INDEX "income_date_idx" ON "income"("date");

-- CreateIndex
CREATE INDEX "income_dossierId_idx" ON "income"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "charge_category_name_key" ON "charge_category"("name");

-- CreateIndex
CREATE INDEX "charge_date_idx" ON "charge"("date");

-- CreateIndex
CREATE INDEX "charge_dossierId_idx" ON "charge"("dossierId");

-- CreateIndex
CREATE INDEX "charge_repeatsMonthly_idx" ON "charge"("repeatsMonthly");

-- CreateIndex
CREATE UNIQUE INDEX "charge_repeatOfId_repeatMonth_key" ON "charge"("repeatOfId", "repeatMonth");

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge" ADD CONSTRAINT "charge_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "charge_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge" ADD CONSTRAINT "charge_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge" ADD CONSTRAINT "charge_repeatOfId_fkey" FOREIGN KEY ("repeatOfId") REFERENCES "charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge" ADD CONSTRAINT "charge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- The starting categories (#95); the consultant edits the list.
INSERT INTO "charge_category" ("id", "name", "position") VALUES
  (gen_random_uuid()::text, 'Loyer', 1),
  (gen_random_uuid()::text, 'Internet & téléphone', 2),
  (gen_random_uuid()::text, 'Publicité', 3),
  (gen_random_uuid()::text, 'Logiciels', 4),
  (gen_random_uuid()::text, 'Partenaires', 5),
  (gen_random_uuid()::text, 'Frais payés pour un client (IRCC, WES, examens…)', 6),
  (gen_random_uuid()::text, 'Transport', 7),
  (gen_random_uuid()::text, 'Salaires', 8),
  (gen_random_uuid()::text, 'Autres', 9);
