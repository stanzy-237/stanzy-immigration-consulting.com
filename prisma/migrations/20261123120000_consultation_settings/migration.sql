-- CreateTable
CREATE TABLE "consultation_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "price" INTEGER,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER NOT NULL,
    "minNoticeHours" INTEGER NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "moveCutoffHours" INTEGER NOT NULL,
    "weeklyHours" JSONB NOT NULL,
    "blockedDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_settings_pkey" PRIMARY KEY ("id")
);
