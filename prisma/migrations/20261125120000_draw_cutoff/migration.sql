-- AlterTable
ALTER TABLE "draw" ADD COLUMN     "drawCutOff" TEXT;


-- The rounds already stored: their tie-breaking time, out of the feed object.
UPDATE "draw" SET "drawCutOff" = NULLIF("raw"->>'drawCutOff', '');
