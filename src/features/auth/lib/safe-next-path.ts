import { routing, type Locale } from '@/i18n/routing';

/** A `?next=` search param as a route receives it. */
export type NextParam = string | string[] | undefined;

const HOME = '/';

// A placeholder origin to resolve `next` against: anything that resolves to a
// different origin was not a same-origin relative path.
const BASE = 'http://stanzy.invalid';

// Sending a signed-in person "back" to a sign-in page would bounce them
// straight off it again.
const GUEST_ONLY_PATHS = ['/connexion', '/inscription'];

// How many layers of percent-encoding to see through (`%252F` → `%2F` → `/`).
const MAX_DECODE_DEPTH = 3;

/**
 * Turns an untrusted `?next=` value into a path that is safe to navigate to
 * after sign-in, or `'/'` (home) when it is not.
 *
 * Only same-origin relative paths survive: absolute URLs, protocol-relative
 * `//host`, backslash tricks (`/\host`), `javascript:` and their
 * percent-encoded variants all fall back to home. The locale prefix is
 * dropped (`/fr/compte` → `/compte`) because the result is meant for the
 * locale-aware router in `@/i18n/navigation`, which adds the current one.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== 'string' || !looksLikeLocalPath(next)) return HOME;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return HOME;
  }
  if (url.origin !== BASE) return HOME;

  const pathname = stripLocale(url.pathname);
  // Normalising dot segments or dropping the locale can surface a `//host`
  // that wasn't visible in the raw value (`/fr//evil.com`, `/.//evil.com`).
  if (!isPlainPath(pathname)) return HOME;
  if (GUEST_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return HOME;
  }
  return `${pathname}${url.search}${url.hash}`;
}

/** True when `value`, and every decoding of it, is a plain `/path`. */
function looksLikeLocalPath(value: string): boolean {
  let current = value;
  for (let depth = 0; depth <= MAX_DECODE_DEPTH; depth++) {
    if (!isPlainPath(current)) return false;
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return false;
    }
    if (decoded === current) return true;
    current = decoded;
  }
  // Still changing after several decodes: not something we produced.
  return false;
}

function isPlainPath(value: string): boolean {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split('/');
  if (!routing.locales.includes(first as Locale)) return pathname;
  return `/${rest.join('/')}`;
}

/**
 * `pathname` with `?next=` carried along (sanitized), e.g. for the links
 * between Connexion and Inscription. Omitted when `next` is home or unsafe.
 */
export function withNext(pathname: string, next: unknown): string {
  const safe = safeNextPath(next);
  return safe === HOME ? pathname : `${pathname}?${new URLSearchParams({ next: safe })}`;
}

/**
 * `safeNextPath` with the locale put back, for redirects that bypass the
 * locale-aware router (e.g. the Google round-trip's `callbackURL`).
 */
export function localizedNextPath(locale: string, next: unknown): string {
  const safe = safeNextPath(next);
  return safe === HOME ? `/${locale}` : `/${locale}${safe}`;
}
