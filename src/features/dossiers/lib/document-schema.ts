import { z } from 'zod';

/** What a Version can be: what IRCC and the evaluators accept, and photos the Outils PDF turn into pages. */
export const DOCUMENT_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export type DocumentFileType = (typeof DOCUMENT_FILE_TYPES)[number];

/** Per file, before encryption. Larger than IRCC's 4 Mo: raw scans are trimmed down in the Outils PDF. */
export const DOCUMENT_FILE_MAX_BYTES = 25 * 1024 * 1024;

/** Where a Dossier's encrypted files live in Vercel Blob; the upload route only signs paths under it. */
export const dossierBlobPrefix = (dossierId: string): string => `dossiers/${dossierId}/`;

/** Whether `url` is a Vercel Blob file under the Dossier's folder (the only place the upload route signs). */
export const isDossierBlob = (url: string, dossierId: string): boolean =>
  isBlobUnder(url, dossierBlobPrefix(dossierId));

/** Whether `url` is a Vercel Blob file whose path starts with `prefix`. */
export function isBlobUnder(url: string, prefix: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === 'https:' &&
    parsed.hostname.endsWith('.blob.vercel-storage.com') &&
    parsed.pathname.slice(1).startsWith(prefix)
  );
}

export const TITLE_MAX = 120;
export const COMMENT_MAX = 2000;

const id = z.string().min(1);
const title = z.string().trim().min(2).max(TITLE_MAX);

export const dossierRefInput = z.object({ dossierId: id });
export const addSectionInput = z.object({ dossierId: id, title });
export const renameSectionInput = z.object({ id, title });
export const addDocumentInput = z.object({ sectionId: id, title });

/**
 * A file already encrypted and sent to Vercel Blob, with its key for the
 * server to wrap (ADR 0007). Also what a Preuve de paiement records.
 */
export const encryptedFileInput = z.object({
  blobUrl: z.string().url(),
  // A 256-bit key and a 96-bit IV, base64.
  key: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(DOCUMENT_FILE_TYPES),
  size: z.number().int().min(1).max(DOCUMENT_FILE_MAX_BYTES),
});

export const addVersionInput = encryptedFileInput.extend({ documentId: id });

/** `versionId` null takes the Finale off. */
export const setFinalInput = z.object({ documentId: id, versionId: id.nullable() });

export const commentInput = z.object({ documentId: id, body: z.string().trim().min(1).max(COMMENT_MAX) });
