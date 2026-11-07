-- AlterTable
ALTER TABLE "stanzy_request" ADD COLUMN     "answers" JSONB;

-- AlterTable
ALTER TABLE "document_service" ADD COLUMN     "prerequisites" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "questionnaire" TEXT;

-- CreateTable
CREATE TABLE "requirement_file" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirement_file_requestId_key_idx" ON "requirement_file"("requestId", "key");

-- AddForeignKey
ALTER TABLE "requirement_file" ADD CONSTRAINT "requirement_file_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "stanzy_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_file" ADD CONSTRAINT "requirement_file_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- What the starting services already in the catalogue ask for (their other fields untouched).
UPDATE "document_service"
SET "prerequisites" = '[{"key":"photo","fr":"Photo","en":"Photo","type":"file","kind":"photo","when":null},{"key":"signature","fr":"Signature numérique","en":"Digital signature","type":"signature","kind":null,"when":null},{"key":"plan-de-localisation","fr":"Plan de localisation","en":"Location map","type":"file","kind":null,"when":null},{"key":"bulletin-de-paie","fr":"Bulletin de paie","en":"Payslip","type":"file","kind":"payslips","when":null},{"key":"photo-donateur","fr":"Photo du donateur","en":"Donor’s photo","type":"file","kind":null,"when":"donation"}]'::jsonb, "questionnaire" = 'proofOfFunds'
WHERE "slug" = 'preuve-de-fonds' AND "prerequisites" = '[]'::jsonb;

UPDATE "document_service"
SET "prerequisites" = '[{"key":"photo","fr":"Photo","en":"Photo","type":"file","kind":"photo","when":null},{"key":"signature","fr":"Signature numérique","en":"Digital signature","type":"signature","kind":null,"when":null},{"key":"plan-de-localisation","fr":"Plan de localisation","en":"Location map","type":"file","kind":null,"when":null},{"key":"bulletin-de-paie","fr":"Bulletin de paie","en":"Payslip","type":"file","kind":"payslips","when":null},{"key":"photo-donateur","fr":"Photo du donateur","en":"Donor’s photo","type":"file","kind":null,"when":"donation"}]'::jsonb, "questionnaire" = 'proofOfFundsNoFunds'
WHERE "slug" = 'preuve-de-fonds-sans-fonds' AND "prerequisites" = '[]'::jsonb;

UPDATE "document_service"
SET "prerequisites" = '[{"key":"cni","fr":"Carte nationale d’identité (CNI)","en":"National ID card (CNI)","type":"file","kind":null,"when":null},{"key":"passeport","fr":"Passeport","en":"Passport","type":"file","kind":"passport","when":null},{"key":"acte-de-naissance","fr":"Acte de naissance","en":"Birth certificate","type":"file","kind":"birthCertificate","when":null},{"key":"bulletin-n-3","fr":"Bulletin n° 3 (extrait de casier judiciaire)","en":"Bulletin no. 3 (criminal record extract)","type":"file","kind":null,"when":null}]'::jsonb, "questionnaire" = NULL
WHERE "slug" = 'certificat-de-police' AND "prerequisites" = '[]'::jsonb;

