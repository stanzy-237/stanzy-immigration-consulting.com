import { describe, expect, it } from 'vitest';

import { articleMetadata, type MetadataArticle } from '@/features/blog/lib/article-metadata';

/** Seam: an Article's search and share tags, from its fields and the site's address. */

const SITE = 'https://stanzy.ca';
const ARTICLE: MetadataArticle = {
  slug: 'reussir-le-tcf-canada',
  locale: 'fr',
  title: 'Réussir le TCF Canada du premier coup',
  excerpt: 'Les quatre épreuves, le barème et un plan de six semaines.',
  fallbackExcerpt: 'Le TCF Canada est le test de français reconnu par IRCC…',
  seoTitle: null,
  seoDescription: null,
  coverUrl: 'https://abc.public.blob.vercel-storage.com/blog/tcf.webp',
  coverAlt: 'Une candidate en salle d’examen',
  publishedAt: new Date('2026-10-20T08:00:00Z'),
  updatedAt: new Date('2026-10-22T15:30:00Z'),
  categoryName: 'Tests de langue',
  tags: ['tcf', 'nclc'],
};

describe('articleMetadata', () => {
  it('describes the Article for search engines and share previews', () => {
    expect(articleMetadata(ARTICLE, SITE)).toEqual({
      title: 'Réussir le TCF Canada du premier coup',
      description: 'Les quatre épreuves, le barème et un plan de six semaines.',
      alternates: { canonical: 'https://stanzy.ca/fr/blog/reussir-le-tcf-canada' },
      openGraph: {
        type: 'article',
        url: 'https://stanzy.ca/fr/blog/reussir-le-tcf-canada',
        title: 'Réussir le TCF Canada du premier coup',
        description: 'Les quatre épreuves, le barème et un plan de six semaines.',
        locale: 'fr_CA',
        publishedTime: '2026-10-20T08:00:00.000Z',
        modifiedTime: '2026-10-22T15:30:00.000Z',
        section: 'Tests de langue',
        tags: ['tcf', 'nclc'],
        images: [{ url: 'https://abc.public.blob.vercel-storage.com/blog/tcf.webp', alt: 'Une candidate en salle d’examen' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Réussir le TCF Canada du premier coup',
        description: 'Les quatre épreuves, le barème et un plan de six semaines.',
        images: ['https://abc.public.blob.vercel-storage.com/blog/tcf.webp'],
      },
    });
  });

  it('prefers the SEO title and description when the consultant set them', () => {
    const meta = articleMetadata({ ...ARTICLE, seoTitle: 'TCF Canada : le guide', seoDescription: 'Tout pour viser NCLC 7.' }, SITE);
    expect(meta.title).toBe('TCF Canada : le guide');
    expect(meta.description).toBe('Tout pour viser NCLC 7.');
    expect(meta.openGraph).toMatchObject({ title: 'TCF Canada : le guide', description: 'Tout pour viser NCLC 7.' });
  });

  it('falls back to the opening of the Article without an excerpt, and to the site logo without a cover', () => {
    const meta = articleMetadata({ ...ARTICLE, excerpt: null, coverUrl: null, coverAlt: null }, SITE);
    expect(meta.description).toBe('Le TCF Canada est le test de français reconnu par IRCC…');
    expect(meta.openGraph).toMatchObject({ images: [{ url: 'https://stanzy.ca/logo2.png', alt: 'Stanzy Immigration Consulting' }] });
    expect(meta.twitter).toMatchObject({ images: ['https://stanzy.ca/logo2.png'] });
  });

  it('points an English Article to its English address', () => {
    const meta = articleMetadata({ ...ARTICLE, locale: 'en', slug: 'pass-the-ielts' }, SITE);
    expect(meta.alternates).toEqual({ canonical: 'https://stanzy.ca/en/blog/pass-the-ielts' });
    expect(meta.openGraph).toMatchObject({ locale: 'en_CA' });
  });
});
