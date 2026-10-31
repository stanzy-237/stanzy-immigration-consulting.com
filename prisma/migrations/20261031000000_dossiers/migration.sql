-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('ACCOMPAGNEMENT', 'VERIFICATION', 'EDE', 'SERVICE_DOCUMENTAIRE');

-- CreateEnum
CREATE TYPE "DossierState" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "DossierEventKind" AS ENUM ('OPENED', 'ADVANCED', 'MOVED_BACK', 'CLOSED');

-- CreateTable
CREATE TABLE "dossier" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "service" "ServiceType" NOT NULL,
    "stage" TEXT NOT NULL,
    "startStage" TEXT NOT NULL,
    "state" "DossierState" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_event" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "kind" "DossierEventKind" NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossier_accountId_createdAt_idx" ON "dossier"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "dossier_state_updatedAt_idx" ON "dossier"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "dossier_event_dossierId_createdAt_idx" ON "dossier_event"("dossierId", "createdAt");

-- AddForeignKey
ALTER TABLE "dossier" ADD CONSTRAINT "dossier_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_event" ADD CONSTRAINT "dossier_event_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_event" ADD CONSTRAINT "dossier_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

