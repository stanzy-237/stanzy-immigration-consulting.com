-- « Suivant » by the Client, then the consultant's confirmation of what was handed over (#80).
ALTER TABLE "stanzy_request" ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3);

ALTER TYPE "NotificationKind" ADD VALUE 'REQUIREMENTS_SUBMITTED';
ALTER TYPE "NotificationKind" ADD VALUE 'REQUIREMENTS_CONFIRMED';
