-- CreateTable
CREATE TABLE "checklist" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "answers" JSONB,
    "ready" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_accountId_key" ON "checklist"("accountId");

-- AddForeignKey
ALTER TABLE "checklist" ADD CONSTRAINT "checklist_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
