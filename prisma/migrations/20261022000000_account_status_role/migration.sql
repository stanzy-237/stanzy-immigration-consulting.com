-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('USER', 'LEAD', 'CLIENT');

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('MEMBER', 'PARTNER', 'CONSULTANT');

-- AlterTable
ALTER TABLE "account" ADD COLUMN     "role" "AccountRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'USER';

