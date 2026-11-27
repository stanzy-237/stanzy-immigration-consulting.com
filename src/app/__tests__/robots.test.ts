import { describe, expect, it } from 'vitest';

import robots from '@/app/robots';

describe('robots.txt', () => {
  it('lets every crawler read the public site, keeps the signed-in areas out and points to the sitemap', () => {
    const rules = robots();

    expect(rules.rules).toEqual([
      expect.objectContaining({ userAgent: '*', allow: '/', disallow: expect.arrayContaining(['/api/', '/fr/tableau-de-bord', '/en/mon-espace']) }),
    ]);
    expect(rules.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
