import { getSessionCookie } from 'better-auth/cookies';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { connexionPathFor, isProtectedPath } from '@/features/auth/lib/protected-routes';
import { routing, type Locale } from '@/i18n/routing';

// Next 16 renamed the Middleware convention to Proxy.
const intlMiddleware = createMiddleware(routing);

/**
 * next-intl handles locales; on top of that, signed-out visitors to a
 * protected page are sent to Connexion with `?next=` set to where they were
 * going. This is only a cookie-presence check: the protected layouts and
 * tRPC procedures make the authoritative session check.
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const [, locale, ...rest] = pathname.split('/');

  if (routing.locales.includes(locale as Locale)) {
    const path = `/${rest.join('/')}`;
    if (isProtectedPath(path) && !getSessionCookie(request)) {
      return NextResponse.redirect(
        new URL(connexionPathFor(locale, `${path}${search}`), request.url),
      );
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for Next internals, API routes and files with an
  // extension (favicon, manifest, service worker, static assets, …).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
