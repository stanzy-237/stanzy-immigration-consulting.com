import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SHARE_CARDS, shareImagePath, shareMetadata } from '@/lib/share-metadata';

describe('shareMetadata', () => {
  it('gives a page its own card in its language, with Open Graph and Twitter tags', () => {
    const meta = shareMetadata({ locale: 'en', path: '/outils/crs', card: 'crs', title: 'CRS calculator', description: 'Compute your score.' });

    expect(meta.openGraph).toMatchObject({
      url: '/en/outils/crs',
      title: 'CRS calculator',
      description: 'Compute your score.',
      locale: 'en_CA',
      alternateLocale: ['fr_CA'],
      images: [{ url: '/og/en/crs.jpg', width: 1200, height: 630, alt: 'CRS calculator' }],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: ['/og/en/crs.jpg'] });
  });

  it('links every language version and points x-default at French', () => {
    const meta = shareMetadata({ locale: 'fr', path: '', card: 'accueil', title: 'Stanzy' });

    expect(meta.robots).toBeUndefined();
    expect(meta.alternates).toEqual({
      canonical: '/fr',
      languages: { fr: '/fr', en: '/en', 'x-default': '/fr' },
    });
  });

  it('keeps a private link out of the index: no canonical, but still a card', () => {
    const meta = shareMetadata({ locale: 'fr', path: '/reunion/abc', card: 'reunion', title: 'Réunion', indexable: false });

    expect(meta.alternates).toBeUndefined();
    expect(meta.robots).toEqual({ index: false });
    expect(meta.openGraph).toMatchObject({ images: [{ url: '/og/fr/reunion.jpg' }] });
  });

  it('falls back to French for an unknown locale', () => {
    expect(shareImagePath('es', 'crs')).toBe('/og/fr/crs.jpg');
  });
});

describe('share cards', () => {
  it.each(['fr', 'en'])('exports every card in %s', (locale) => {
    for (const card of SHARE_CARDS) {
      expect(existsSync(join(process.cwd(), 'public', shareImagePath(locale, card)))).toBe(true);
    }
  });
});
