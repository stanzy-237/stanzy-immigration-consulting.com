/**
 * Envelope encryption for Documents de service (ADR 0007), with Web Crypto so
 * the same code runs in the browser and on the server. Each file gets its own
 * AES-256-GCM key; the server keeps that key encrypted with DOSSIER_FILES_KEY.
 */

const AES = 'AES-GCM';
const IV_BYTES = 12;

const subtle = (): SubtleCrypto => globalThis.crypto.subtle;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const importKey = (raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> =>
  subtle().importKey('raw', raw, AES, false, ['encrypt', 'decrypt']);

const randomBytes = (length: number): Uint8Array<ArrayBuffer> =>
  globalThis.crypto.getRandomValues(new Uint8Array(length));

/** Encrypts a file with a fresh key; the key and IV travel base64. */
export async function encryptFile(plain: ArrayBuffer): Promise<{ ciphertext: ArrayBuffer; key: string; iv: string }> {
  const raw = randomBytes(32);
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await subtle().encrypt({ name: AES, iv }, await importKey(raw), plain);
  return { ciphertext, key: toBase64(raw), iv: toBase64(iv) };
}

/** Reverses `encryptFile`; throws if the file or key was tampered with. */
export async function decryptFile(ciphertext: ArrayBuffer, key: string, iv: string): Promise<ArrayBuffer> {
  return subtle().decrypt({ name: AES, iv: fromBase64(iv) }, await importKey(fromBase64(key)), ciphertext);
}

/** Encrypts a file key with the master key: base64 of IV + ciphertext. */
export async function wrapKey(key: string, masterKey: string): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const sealed = await subtle().encrypt({ name: AES, iv }, await importKey(fromBase64(masterKey)), fromBase64(key));
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return toBase64(out);
}

/** Reverses `wrapKey`. */
export async function unwrapKey(wrapped: string, masterKey: string): Promise<string> {
  const bytes = fromBase64(wrapped);
  const plain = await subtle().decrypt(
    { name: AES, iv: bytes.slice(0, IV_BYTES) },
    await importKey(fromBase64(masterKey)),
    bytes.slice(IV_BYTES),
  );
  return toBase64(new Uint8Array(plain));
}
