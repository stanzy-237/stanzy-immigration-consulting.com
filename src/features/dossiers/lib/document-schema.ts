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

/** Where a Dossier's encrypted files live in the private R2 bucket; uploads are only signed under it (#87). */
export const dossierFilePrefix = (dossierId: string): string => `dossiers/${dossierId}/`;

export const TITLE_MAX = 120;
export const COMMENT_MAX = 2000;

const id = z.string().min(1);
const title = z.string().trim().min(2).max(TITLE_MAX);

export const dossierRefInput = z.object({ dossierId: id });
export const addSectionInput = z.object({ dossierId: id, title });
export const renameSectionInput = z.object({ id, title });
export const addDocumentInput = z.object({ sectionId: id, title });

/**
 * A file already encrypted and sent to R2, with its key for the server to
 * wrap (ADR 0007). Also what a Preuve de paiement records.
 */
export const encryptedFileInput = z.object({
  /** Its key in the private bucket, as the upload route gave it. */
  objectKey: z.string().min(1).max(300),
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

const commentBody = z.string().trim().min(1).max(COMMENT_MAX);

/** A comment on a Document, or (`parentId`) a reply to one. */
export const commentInput = z.object({ documentId: id, parentId: id.optional(), body: commentBody });
export const editCommentInput = z.object({ id, body: commentBody });
export const deleteCommentInput = z.object({ id });
