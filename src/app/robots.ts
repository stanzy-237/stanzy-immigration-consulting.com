import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site-url';

/**
 * Every crawler, AI search engines included, may read the public site; the
 * signed-in areas and the API stay out. The sitemap lists the pages to index.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/fr/tableau-de-bord', '/en/tableau-de-bord', '/fr/mon-espace', '/en/mon-espace'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
