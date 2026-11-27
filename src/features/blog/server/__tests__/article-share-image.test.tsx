// @vitest-environment node
import { writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPublishedArticle = vi.fn();
vi.mock('@/features/blog/server/blog-pages', () => ({ getPublishedArticle: (slug: string) => getPublishedArticle(slug) }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: { minutes: number }) =>
    key === 'readingMinutes' ? `${values?.minutes} min de lecture` : 'Le blog Stanzy',
}));

const { articleShareImage, CARD_CACHE_CONTROL, coverSource } = await import('@/features/blog/server/article-share-image');

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

/** Seam: an Article's share card, drawn from its fields (the brand fonts and logo read from disk). */
describe('articleShareImage', () => {
  beforeEach(() => getPublishedArticle.mockReset());

  it('draws a 1200 × 630 PNG with the Article and its cover', async () => {
    getPublishedArticle.mockResolvedValue({
      title: 'Tirage francophone du 27 octobre : ce qu’il faut retenir',
      seoTitle: null,
      coverUrl: '/blog/covers/tirage-francophone-27-octobre.jpg',
      readingMinutes: 5,
      category: { slug: 'tirages', nameFr: 'Tirages', nameEn: 'Draws' },
    });

    const response = await articleShareImage('tirage-francophone-27-octobre', 'fr');
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.headers.get('content-type')).toBe('image/png');
    expect([...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect(response.headers.get('cache-control')).toBe(CARD_CACHE_CONTROL);
    if (process.env.SHARE_IMAGE_OUT) await writeFile(process.env.SHARE_IMAGE_OUT, bytes);
  });

  it('still draws a card for an unknown slug', async () => {
    getPublishedArticle.mockResolvedValue(null);

    const response = await articleShareImage('nope', 'en');

    expect(response.headers.get('content-type')).toBe('image/png');
  });
});

/** Seam: the cover handed to Satori, which draws PNG and JPEG only. */
describe('coverSource', () => {
  const served = (type: string, status = 200) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status, headers: { 'content-type': type } }));

  beforeEach(() => vi.restoreAllMocks());

  it('reads a JPEG cover kept in public/ as a data URI', async () => {
    expect(await coverSource('/blog/covers/tirage-francophone-27-octobre.jpg')).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('fetches an uploaded JPEG or PNG cover', async () => {
    served('image/png');
    expect(await coverSource('https://blob.example/cover.png')).toBe('data:image/png;base64,AQID');
  });

  it('leaves out a WebP or AVIF cover, which Satori cannot draw', async () => {
    served('image/webp');
    expect(await coverSource('https://blob.example/cover.webp')).toBeNull();
    expect(await coverSource('/blog/covers/cover.avif')).toBeNull();
  });

  it('leaves out a cover that is missing or does not answer', async () => {
    served('image/jpeg', 404);
    expect(await coverSource('https://blob.example/gone.jpg')).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    expect(await coverSource('https://blob.example/slow.jpg')).toBeNull();
    expect(await coverSource('/blog/covers/absent.jpg')).toBeNull();
  });
});
