import { describe, expect, it } from 'vitest';

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
