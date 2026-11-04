import { describe, expect, it, vi } from 'vitest';

import { blogImageKey } from '@/features/blog/lib/upload-image';
import { isKeyUnder } from '@/server/storage/r2';

describe('which stored files a record accepts', () => {
  it('takes only plain keys under its own folder', () => {
    expect(isKeyUnder('dossiers/dos_1/5f1c.bin', 'dossiers/dos_1/')).toBe(true);
    expect(isKeyUnder('dossiers/dos_12/5f1c.bin', 'dossiers/dos_1/')).toBe(false);
    expect(isKeyUnder('dossiers/dos_1/../dos_2/5f1c.bin', 'dossiers/dos_1/')).toBe(false);
    expect(isKeyUnder('dossiers/dos_1//5f1c.bin', 'dossiers/dos_1/')).toBe(false);
  });
});

describe('blog image keys', () => {
  it('stay unique and readable', () => {
    expect(blogImageKey('Étudier au Canada (2026).JPG', 'a1b2')).toBe('blog/a1b2-etudier-au-canada-2026-.jpg');
    expect(blogImageKey('###', 'a1b2')).toBe('blog/a1b2-image');
  });
});

describe('writing from the server', () => {
  it('sends the bytes with the signed address, so R2 knows their length', async () => {
    vi.resetModules();
    for (const [name, value] of Object.entries({
      R2_ACCOUNT_ID: 'acct',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_PRIVATE_BUCKET: 'private-bucket',
      R2_PUBLIC_BUCKET: 'public-bucket',
    })) {
      vi.stubEnv(name, value);
    }
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(null, { status: 200 });
    });
    const { writeObject } = await import('@/server/storage/r2');
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    await writeObject('private', 'dossiers/dos_1/a.bin', bytes, { contentType: 'application/octet-stream' });

    const [url, init] = calls[0]!;
    expect(url).toMatch(/^https:\/\/acct\.r2\.cloudflarestorage\.com\/private-bucket\/dossiers\/dos_1\/a\.bin\?/);
    expect(url).toContain('X-Amz-Signature=');
    expect(init).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' } });
    // The bytes themselves, not a stream: their length goes with them.
    expect(init.body).toBe(bytes);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
