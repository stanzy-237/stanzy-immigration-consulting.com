import { del, get, head } from '@vercel/blob';

import { DOCUMENT_FILE_MAX_BYTES } from '@/features/dossiers/lib/document-schema';
import { decryptFile, unwrapKey, wrapKey } from '@/features/dossiers/lib/file-crypto';
import { env } from '@/lib/env';

/** AES-GCM adds a 16-byte tag to each file. */
export const ENCRYPTED_FILE_MAX_BYTES = DOCUMENT_FILE_MAX_BYTES + 16;

/** The master key, or DOSSIER_FILES_UNCONFIGURED when the deploy has none. */
export function masterKey(): string {
  if (!env.DOSSIER_FILES_KEY) throw new Error('DOSSIER_FILES_UNCONFIGURED');
  return env.DOSSIER_FILES_KEY;
}

/** The stored file's size in bytes, or null when it isn't there. */
export async function storedSize(url: string): Promise<number | null> {
  try {
    return (await head(url)).size;
  } catch {
    return null;
  }
}

export const sealKey = (key: string): Promise<string> => wrapKey(key, masterKey());

/** Fetches a Version's encrypted file and decrypts it. */
export async function openVersionFile(version: {
  blobUrl: string;
  wrappedKey: string;
  iv: string;
}): Promise<ArrayBuffer> {
  const result = await get(version.blobUrl, { access: 'public', useCache: false });
  if (!result || result.statusCode !== 200) throw new Error('DOSSIER_FILE_MISSING');
  const ciphertext = await new Response(result.stream).arrayBuffer();
  return decryptFile(ciphertext, await unwrapKey(version.wrappedKey, masterKey()), version.iv);
}

/** Removes files from Vercel Blob; a failure is logged, the rows are already gone. */
export async function deleteFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (error) {
    console.error('[dossiers] could not delete files from Blob', error);
  }
}
