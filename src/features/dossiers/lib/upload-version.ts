import {
  DOCUMENT_FILE_MAX_BYTES,
  DOCUMENT_FILE_TYPES,
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
 * Encrypts a file in the browser and sends it to the private R2 bucket
 * (ADR 0007, #87): `uploadRoute` names where it goes, then the ciphertext is
 * PUT there directly. Resolves to what the server records. Rejects
 * DOCUMENT_FILE_TYPE or DOCUMENT_FILE_TOO_LARGE before sending anything,
 * DOSSIER_FILES_UNCONFIGURED or DOCUMENT_FILE_INVALID after.
 */
export async function uploadEncryptedFile(
  file: File,
  target: { uploadRoute: string; payload: Record<string, string> },
) {
  const contentType = documentFileType(file);
  if (!contentType) throw new Error('DOCUMENT_FILE_TYPE');
  if (file.size === 0 || file.size > DOCUMENT_FILE_MAX_BYTES) throw new Error('DOCUMENT_FILE_TOO_LARGE');

  const response = await fetch(target.uploadRoute, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target.payload),
  });
  if (!response.ok) {
    throw new Error(response.status === 503 ? 'DOSSIER_FILES_UNCONFIGURED' : 'DOCUMENT_FILE_INVALID');
  }
  const { objectKey, uploadUrl } = (await response.json()) as { objectKey: string; uploadUrl: string };

  const { ciphertext, key, iv } = await encryptFile(await file.arrayBuffer());
  const stored = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: ciphertext,
  });
  if (!stored.ok) throw new Error('DOCUMENT_FILE_INVALID');
  return { objectKey, key, iv, fileName: file.name, contentType, size: file.size };
}

/** A Document's next Version. */
export const uploadVersionFile = (documentId: string, file: File) =>
  uploadEncryptedFile(file, { uploadRoute: '/api/dossiers/upload', payload: { documentId } });

/** Where a Version opens, decrypted by the server. */
export const versionFileUrl = (versionId: string): string => `/api/dossiers/files/${versionId}`;
