import { defineRouting } from 'next-intl/routing';

/**
 * The platform is French-first (see GLOSSARY.md): `fr` is the default locale.
 * `localePrefix` is left at its default (`'always'`), so every route is
 * locale-scoped (`/fr/…`, `/en/…`) and `/` redirects to `/fr`. `en` is the only
 * secondary locale for v1.
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
});

export type Locale = (typeof routing.locales)[number];

/** Narrows any value (a stored preference, a query param) to a supported locale. */
export function toLocale(value: unknown): Locale {
  return routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
}

/**
 * Shape of the `[locale]` route segment params. The segment arrives as a raw
 * string (it is validated against `routing.locales` in the layout); this alias
 * keeps the four route signatures that consume it in sync.
 */
export type LocaleParams = Promise<{ locale: string }>;
