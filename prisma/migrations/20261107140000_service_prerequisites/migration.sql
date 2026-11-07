-- AlterTable
ALTER TABLE "document_service" ADD COLUMN     "prerequisites" JSONB NOT NULL DEFAULT '[]';


-- The police certificate's documents, for the copy of it already in the catalogue (its other fields untouched).
UPDATE "document_service"
SET "prerequisites" = '[{"fr":"Carte nationale d’identité (CNI)","en":"National ID card (CNI)","kind":null},{"fr":"Passeport","en":"Passport","kind":"passport"},{"fr":"Acte de naissance","en":"Birth certificate","kind":"birthCertificate"},{"fr":"Bulletin n° 3 (extrait de casier judiciaire)","en":"Bulletin no. 3 (criminal record extract)","kind":null}]'::jsonb
WHERE "slug" = 'certificat-de-police' AND "prerequisites" = '[]'::jsonb;
