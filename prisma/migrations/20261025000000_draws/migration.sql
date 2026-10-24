-- CreateEnum
CREATE TYPE "DrawGroup" AS ENUM ('GENERAL', 'PNP', 'CEC', 'FRENCH', 'CATEGORY');

-- CreateTable
CREATE TABLE "draw" (
    "round" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "group" "DrawGroup" NOT NULL,
    "invitations" INTEGER NOT NULL,
    "crsMin" INTEGER NOT NULL,
    "irccUrl" TEXT,
    "raw" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "draw_pkey" PRIMARY KEY ("round")
);

-- CreateTable
CREATE TABLE "draw_sync" (
    "id" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draw_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscription" (
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("endpoint")
);

-- CreateIndex
CREATE INDEX "draw_date_roundNumber_idx" ON "draw"("date" DESC, "roundNumber" DESC);

-- CreateIndex
CREATE INDEX "push_subscription_accountId_idx" ON "push_subscription"("accountId");

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

