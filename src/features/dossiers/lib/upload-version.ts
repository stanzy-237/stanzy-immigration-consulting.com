import { upload } from '@vercel/blob/client';

import {
  DOCUMENT_FILE_MAX_BYTES,
  DOCUMENT_FILE_TYPES,
  dossierBlobPrefix,
  type DocumentFileType,
} from '@/features/dossiers/lib/document-schema';
import { encryptFile } from '@/features/dossiers/lib/file-crypto';

const BY_EXTENSION: Record<string, DocumentFileType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** The file's type, from the browser or (HEIC photos often come without one) its extension; null if not accepted. */
export function documentFileType(file: { name: string; type: string }): DocumentFileType | null {
  if ((DOCUMENT_FILE_TYPES as readonly string[]).includes(file.type)) return file.type as DocumentFileType;
  return BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null;
}

/**
 * Encrypts a file in the browser and sends it to Vercel Blob (ADR 0007).
 * Resolves to what `dossiers.documents.addVersion` records. Rejects
 * DOCUMENT_FILE_TYPE or DOCUMENT_FILE_TOO_LARGE before sending anything.
 */
export async function uploadVersionFile(dossierId: string, documentId: string, file: File) {
  const contentType = documentFileType(file);
  if (!contentType) throw new Error('DOCUMENT_FILE_TYPE');
  if (file.size === 0 || file.size > DOCUMENT_FILE_MAX_BYTES) throw new Error('DOCUMENT_FILE_TOO_LARGE');

  const { ciphertext, key, iv } = await encryptFile(await file.arrayBuffer());
  const blob = await upload(`${dossierBlobPrefix(dossierId)}${documentId}.bin`, new Blob([ciphertext]), {
    access: 'public',
    contentType: 'application/octet-stream',
    handleUploadUrl: '/api/dossiers/upload',
    clientPayload: JSON.stringify({ documentId }),
  });
  return { blobUrl: blob.url, key, iv, fileName: file.name, contentType, size: file.size };
}

/** Where a Version opens, decrypted by the server. */
export const versionFileUrl = (versionId: string): string => `/api/dossiers/files/${versionId}`;
