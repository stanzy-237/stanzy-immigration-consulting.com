-- CreateTable
CREATE TABLE "crs_simulation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "rules" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crs_simulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crs_simulation_accountId_updatedAt_idx" ON "crs_simulation"("accountId", "updatedAt");

-- AddForeignKey
ALTER TABLE "crs_simulation" ADD CONSTRAINT "crs_simulation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

