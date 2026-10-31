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

type StoredFile = { blobUrl: string; wrappedKey: string; iv: string; fileName: string; contentType: string };

/** Fetches an encrypted file (a Version, a Preuve de paiement) and decrypts it. */
export async function openEncryptedFile(file: StoredFile): Promise<ArrayBuffer> {
  const result = await get(file.blobUrl, { access: 'public', useCache: false });
  if (!result || result.statusCode !== 200) throw new Error('DOSSIER_FILE_MISSING');
  const ciphertext = await new Response(result.stream).arrayBuffer();
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

/** Removes files from Vercel Blob; a failure is logged, the rows are already gone. */
export async function deleteFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (error) {
    console.error('[dossiers] could not delete files from Blob', error);
  }
}
