import type { Metadata } from 'next';

import { routing } from '@/i18n/routing';

/**
 * The share cards drawn in Paper (Marketing Stanzy · « Partage · FR|EN · … »),
 * exported to `public/og/<locale>/<card>.jpg` at 1200 × 630.
 */
export const SHARE_CARDS = [
  'accueil', 'services', 'outils', 'blog', 'consultation', 'accompagnement', 'verification', 'ede',
  'crs', '67-points', 'nclc-clb', 'cnp', 'dernier-tirage', 'compte-a-rebours-ita', 'timeline',
  'budget', 'checklist', 'coffre-fort', 'pdf', 'offre', 'reunion', 'compte',
] as const;

export type ShareCard = (typeof SHARE_CARDS)[number];

/** The site's name in every preview (`og:site_name`). */
export const SITE_NAME = 'Stanzy Immigration Consulting';

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

const OG_LOCALES: Record<string, string> = { fr: 'fr_CA', en: 'en_CA' };

/** The Open Graph locale (`fr_CA`, `en_CA`) of a site language. */
export const ogLocale = (locale: string): string => OG_LOCALES[locale] ?? OG_LOCALES[routing.defaultLocale];

/** A card as an Open Graph image, its alt text being the page's title. */
export const shareImage = (locale: string, card: ShareCard, alt: string) => ({
  url: shareImagePath(locale, card),
  ...SHARE_IMAGE_SIZE,
  alt,
});

/** A page's share card address, relative to `metadataBase`. */
export function shareImagePath(locale: string, card: ShareCard): string {
  const lang = routing.locales.includes(locale as (typeof routing.locales)[number]) ? locale : routing.defaultLocale;
  return `/og/${lang}/${card}.jpg`;
}

type ShareMetadataInput = {
  locale: string;
  /** The route after the locale, `''` for the home page, e.g. `/outils/crs`. */
  path: string;
  card: ShareCard;
  title: string;
  description?: string;
  /** Private links (an offer, a meeting, sign-in) are shared but never indexed: `noindex`, no canonical, no hreflang. */
  indexable?: boolean;
};

/**
 * A page's title, description, canonical and hreflang addresses, and its
 * Open Graph / Twitter tags with its own card. Next replaces the layout's
 * `openGraph` whole when a page sets one, so every field is given here.
 */
export function shareMetadata({
  locale,
  path,
  card,
  title,
  description,
  indexable = true,
}: ShareMetadataInput): Metadata {
  const url = `/${locale}${path}`;
  const image = shareImage(locale, card, title);

  return {
    title,
    ...(description ? { description } : {}),
    ...(indexable
      ? {
          alternates: {
            canonical: url,
            languages: {
              ...Object.fromEntries(routing.locales.map((lang) => [lang, `/${lang}${path}`])),
              'x-default': `/${routing.defaultLocale}${path}`,
            },
          },
        }
      : { robots: { index: false } }),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url,
      title,
      ...(description ? { description } : {}),
      locale: ogLocale(locale),
      alternateLocale: routing.locales.filter((lang) => lang !== locale).map(ogLocale),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      ...(description ? { description } : {}),
      images: [image.url],
    },
  };
}
