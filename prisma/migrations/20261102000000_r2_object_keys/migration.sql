-- Files move from Vercel Blob to Cloudflare R2 (#87): rows keep the object's
-- key in the private bucket instead of a public Blob address. No row holds a
-- real file yet (uploads never succeeded on Blob), so the values are kept as is.
ALTER TABLE "document_version" RENAME COLUMN "blobUrl" TO "objectKey";
ALTER TABLE "payment_proof" RENAME COLUMN "blobUrl" TO "objectKey";
