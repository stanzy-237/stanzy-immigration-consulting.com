import { TRPCError } from '@trpc/server';

import { DOCUMENT_FILE_MAX_BYTES } from '@/features/dossiers/lib/document-schema';
import { decryptFile, unwrapKey, wrapKey } from '@/features/dossiers/lib/file-crypto';
import { env } from '@/lib/env';
import { deleteObjects, isKeyUnder, objectSize, presignUpload, readObject } from '@/server/storage/r2';

/** AES-GCM adds a 16-byte tag to each file. */
export const ENCRYPTED_FILE_MAX_BYTES = DOCUMENT_FILE_MAX_BYTES + 16;

/** The type every encrypted upload is sent as: the real one is only known after decryption. */
export const ENCRYPTED_CONTENT_TYPE = 'application/octet-stream';

/** The master key, or DOSSIER_FILES_UNCONFIGURED when the deploy has none. */
export function masterKey(): string {
  if (!env.DOSSIER_FILES_KEY) throw new Error('DOSSIER_FILES_UNCONFIGURED');
  return env.DOSSIER_FILES_KEY;
}

export const sealKey = (key: string): Promise<string> => wrapKey(key, masterKey());

/**
 * Where the browser sends an encrypted file (a Version, a Preuve de paiement):
 * a fresh object key under `prefix` in the private bucket, and a short-lived
 * address to PUT it to (ADR 0007, #87).
 */
export async function prepareEncryptedUpload(prefix: string): Promise<{ objectKey: string; uploadUrl: string }> {
  masterKey();
  const objectKey = `${prefix}${crypto.randomUUID()}.bin`;
  return { objectKey, uploadUrl: await presignUpload('private', objectKey, ENCRYPTED_CONTENT_TYPE) };
}

/**
 * Whether the browser really stored the file it announces: under `prefix`,
 * and exactly 16 bytes (the GCM tag) larger than its plain size. A file that
 * doesn't match is removed. Throws DOCUMENT_FILE_INVALID.
 */
export async function checkEncryptedUpload(objectKey: string, prefix: string, plainSize: number): Promise<void> {
  if (!isKeyUnder(objectKey, prefix)) throw new Error('DOCUMENT_FILE_INVALID');
  const size = await objectSize('private', objectKey).catch(() => null);
  if (size === plainSize + 16 && size <= ENCRYPTED_FILE_MAX_BYTES) return;
  if (size !== null) await deleteObjects('private', [objectKey]);
  throw new Error('DOCUMENT_FILE_INVALID');
}

/**
 * For a procedure recording an upload: checks the stored file (BAD_REQUEST
 * DOCUMENT_FILE_INVALID) and returns its key wrapped with the master key
 * (PRECONDITION_FAILED DOSSIER_FILES_UNCONFIGURED without one).
 */
export async function acceptEncryptedUpload(
  file: { objectKey: string; key: string; size: number },
  prefix: string,
): Promise<string> {
  try {
    await checkEncryptedUpload(file.objectKey, prefix, file.size);
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'DOCUMENT_FILE_INVALID' });
  }
  try {
    return await sealKey(file.key);
  } catch {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'DOSSIER_FILES_UNCONFIGURED' });
  }
}

type StoredFile = { objectKey: string; wrappedKey: string; iv: string; fileName: string; contentType: string };

/** Fetches an encrypted file (a Version, a Preuve de paiement) and decrypts it. */
export async function openEncryptedFile(file: StoredFile): Promise<ArrayBuffer> {
  const ciphertext = await readObject('private', file.objectKey);
  return decryptFile(ciphertext, await unwrapKey(file.wrappedKey, masterKey()), file.iv);
}

/**
 * The decrypted file as a response: never cached, shown in the browser
 * (every accepted type, PDF or image, is safe inline) unless `?download`.
 */
export async function serveEncryptedFile(request: Request, file: StoredFile): Promise<Response> {
  try {
    const body = await openEncryptedFile(file);
    const download = new URL(request.url).searchParams.has('download');
    return new Response(body, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[dossiers] could not open an encrypted file', error);
    return new Response(null, { status: 502 });
  }
}

/** Removes encrypted files whose rows are gone. */
export const deleteFiles = (objectKeys: string[]): Promise<void> => deleteObjects('private', objectKeys);
