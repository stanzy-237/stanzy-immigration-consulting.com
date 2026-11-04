import { encryptFile } from '@/features/dossiers/lib/file-crypto';
import { ENCRYPTED_CONTENT_TYPE, sealKey } from '@/features/dossiers/server/dossier-files';
import { writeObject } from '@/server/storage/r2';

/** A PDF the server made, stored encrypted under `prefix` in the private bucket (ADR 0007). */
export async function storeEncryptedPdf(
  prefix: string,
  bytes: Uint8Array,
): Promise<{ objectKey: string; wrappedKey: string; iv: string; size: number }> {
  const { ciphertext, key, iv } = await encryptFile(bytes.slice().buffer as ArrayBuffer);
  const objectKey = `${prefix}${crypto.randomUUID()}.bin`;
  await writeObject('private', objectKey, ciphertext, { contentType: ENCRYPTED_CONTENT_TYPE });
  return { objectKey, wrappedKey: await sealKey(key), iv, size: bytes.byteLength };
}
