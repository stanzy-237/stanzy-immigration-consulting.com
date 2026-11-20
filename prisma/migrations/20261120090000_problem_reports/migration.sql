-- CreateEnum
CREATE TYPE "ProblemReportStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'IGNORED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'PROBLEM_REPORTED';

-- CreateTable
CREATE TABLE "problem_report" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "userAgent" TEXT,
    "rollbarIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ProblemReportStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "problem_report_status_createdAt_idx" ON "problem_report"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

