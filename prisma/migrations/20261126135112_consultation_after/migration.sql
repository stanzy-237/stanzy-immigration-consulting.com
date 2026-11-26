-- AlterTable
ALTER TABLE "consultation" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "consultation_note" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "atSeconds" INTEGER,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_step" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_step_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultation_note_consultationId_idx" ON "consultation_note"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_step_consultationId_position_idx" ON "consultation_step"("consultationId", "position");

-- AddForeignKey
ALTER TABLE "consultation_note" ADD CONSTRAINT "consultation_note_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_step" ADD CONSTRAINT "consultation_step_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
