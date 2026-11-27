import { describe, expect, it } from 'vitest';

import { articleJsonLd } from '@/features/blog/lib/article-json-ld';

const SITE = 'https://www.stanzy-immigration-consulting.com';

/** Seam: an Article's structured data and its breadcrumb. */
describe('articleJsonLd', () => {
  const data = articleJsonLd(
    {
      slug: 'cnps-obligatoire-dossier-ircc',
      locale: 'fr',
      title: 'La CNPS est-elle obligatoire pour votre dossier IRCC ?',
      description: 'Ce que regarde IRCC.',
      authorName: 'Richil',
      publishedAt: new Date('2026-10-28T15:18:16Z'),
      updatedAt: new Date('2026-10-29T08:00:00Z'),
      categoryName: 'Documents',
      tags: ['cnps'],
    },
    SITE,
    { home: 'Stanzy', blog: 'Blog' },
  ) as { '@graph': Record<string, unknown>[] };

  it('is a BlogPosting published by the organization, with its share card as image', () => {
    expect(data['@graph'][0]).toMatchObject({
      '@type': 'BlogPosting',
      headline: 'La CNPS est-elle obligatoire pour votre dossier IRCC ?',
      inLanguage: 'fr',
      datePublished: '2026-10-28T15:18:16.000Z',
      author: { '@type': 'Person', name: 'Richil' },
      publisher: { '@id': `${SITE}/#organization` },
      image: `${SITE}/fr/blog/cnps-obligatoire-dossier-ircc/opengraph-image`,
    });
  });

  it('leads to the Article through the home page and the Blog', () => {
    expect(data['@graph'][1]).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, item: `${SITE}/fr` },
        { position: 2, item: `${SITE}/fr/blog` },
        { position: 3, item: `${SITE}/fr/blog/cnps-obligatoire-dossier-ircc` },
      ],
    });
  });
});
