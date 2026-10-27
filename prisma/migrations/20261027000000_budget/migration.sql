-- CreateTable
CREATE TABLE "budget_expense" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_profile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "estimate" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_expense_accountId_date_idx" ON "budget_expense"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "budget_profile_accountId_key" ON "budget_profile"("accountId");

-- AddForeignKey
ALTER TABLE "budget_expense" ADD CONSTRAINT "budget_expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_profile" ADD CONSTRAINT "budget_profile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
