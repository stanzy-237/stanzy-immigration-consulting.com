import { describe, expect, it } from 'vitest';

import { decryptFile, encryptFile, toBase64, unwrapKey, wrapKey } from '@/features/dossiers/lib/file-crypto';

const master = toBase64(globalThis.crypto.getRandomValues(new Uint8Array(32)));
const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const text = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer);

describe('Documents de service encryption (ADR 0007)', () => {
  it('gives back the file through a wrapped key, as the server reads it', async () => {
    const { ciphertext, key, iv } = await encryptFile(bytes('relevé de notes'));
    expect(ciphertext.byteLength).toBe(bytes('relevé de notes').byteLength + 16);
    const wrapped = await wrapKey(key, master);
    expect(wrapped).not.toContain(key);
    expect(text(await decryptFile(ciphertext, await unwrapKey(wrapped, master), iv))).toBe('relevé de notes');
  });

  it('refuses a file that was changed, or a key wrapped with another master key', async () => {
    const { ciphertext, key, iv } = await encryptFile(bytes('diplôme'));
    const tampered = new Uint8Array(ciphertext.slice(0));
    tampered[0] ^= 1;
    await expect(decryptFile(tampered.buffer, key, iv)).rejects.toThrow();

    const other = toBase64(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    await expect(unwrapKey(await wrapKey(key, master), other)).rejects.toThrow();
  });
});
