// @vitest-environment node
import { writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPublishedArticle = vi.fn();
vi.mock('@/features/blog/server/blog-pages', () => ({ getPublishedArticle: (slug: string) => getPublishedArticle(slug) }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: { minutes: number }) =>
    key === 'readingMinutes' ? `${values?.minutes} min de lecture` : 'Le blog Stanzy',
}));

const { articleShareImage } = await import('@/features/blog/server/article-share-image');

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
    if (process.env.SHARE_IMAGE_OUT) await writeFile(process.env.SHARE_IMAGE_OUT, bytes);
  });

  it('still draws a card for an unknown slug', async () => {
    getPublishedArticle.mockResolvedValue(null);

    const response = await articleShareImage('nope', 'en');

    expect(response.headers.get('content-type')).toBe('image/png');
  });
});
