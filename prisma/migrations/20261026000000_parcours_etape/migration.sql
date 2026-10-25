-- CreateTable
CREATE TABLE "parcours_etape" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcours_etape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parcours_etape_accountId_date_idx" ON "parcours_etape"("accountId", "date");

-- AddForeignKey
ALTER TABLE "parcours_etape" ADD CONSTRAINT "parcours_etape_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
