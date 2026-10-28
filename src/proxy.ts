import { getSessionCookie } from 'better-auth/cookies';
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { connexionPathFor, isProtectedPath } from '@/features/auth/lib/protected-routes';
import {
  DASHBOARD_ROUTE,
  dashboardOrigin,
  isDashboardHost,
  siteOriginOf,
} from '@/features/dashboard/lib/dashboard-host';
import { routing, type Locale } from '@/i18n/routing';

// Next 16 renamed the Middleware convention to Proxy.
const intlMiddleware = createMiddleware(routing);

/**
 * The origin the browser asked for. `nextUrl` can report the server's own
 * host (`localhost` in dev), so the Host header wins (`x-forwarded-host`
 * behind Vercel's proxy).
 */
function requestOrigin(request: NextRequest): URL {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return new URL(`${protocol}://${host}`);
}

/** Pages the Tableau de bord's subdomain keeps: signing in and its follow-ups. */
const DASHBOARD_HOST_AUTH_PAGES = ['/connexion', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe', '/verification'];

/**
 * `admin.<site>`: its paths are the Tableau de bord's (`/blog` is
 * `/fr/tableau-de-bord/blog`), sign-in stays here, and any other page of the
 * site goes back to the main domain.
 */
function dashboardHost(request: NextRequest, origin: string): NextResponse {
  const { pathname, search } = request.nextUrl;
  const [, locale, ...rest] = pathname.split('/');

  if (routing.locales.includes(locale as Locale)) {
    const path = `/${rest.join('/')}`;
    // Where Connexion lands after signing in: the short address instead.
    if (path === DASHBOARD_ROUTE || path.startsWith(`${DASHBOARD_ROUTE}/`)) {
      return NextResponse.redirect(new URL(`${path.slice(DASHBOARD_ROUTE.length) || '/'}${search}`, origin));
    }
    if (DASHBOARD_HOST_AUTH_PAGES.includes(path)) return intlMiddleware(request);
    const site = siteOriginOf(origin);
    // In dev Next sees every request as localhost:3000 and would turn this
    // redirect into one to the same page: serve the page instead.
    if (site === request.nextUrl.origin) return intlMiddleware(request);
    return NextResponse.redirect(new URL(`${pathname}${search}`, site));
  }

  if (!getSessionCookie(request)) {
    const next = `${DASHBOARD_ROUTE}${pathname === '/' ? '' : pathname}${search}`;
    return NextResponse.redirect(new URL(connexionPathFor(routing.defaultLocale, next), origin));
  }
  // Rewritten on the request's own URL, so Next renders its page (not a proxy to another host).
  const page = request.nextUrl.clone();
  page.pathname = `/${routing.defaultLocale}${DASHBOARD_ROUTE}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(page);
}

/**
 * next-intl handles locales; on top of that, signed-out visitors to a
 * protected page are sent to Connexion with `?next=` set to where they were
 * going. This is only a cookie-presence check: the protected layouts and
 * tRPC procedures make the authoritative session check. The Tableau de bord
 * lives on `admin.<site>` (see `dashboardHost`).
 */
export default function proxy(request: NextRequest): NextResponse {
  const origin = requestOrigin(request);
  if (isDashboardHost(origin.hostname)) return dashboardHost(request, origin.origin);

  const { pathname, search } = request.nextUrl;
  const [, locale, ...rest] = pathname.split('/');

  if (routing.locales.includes(locale as Locale)) {
    const path = `/${rest.join('/')}`;
    if (path === DASHBOARD_ROUTE || path.startsWith(`${DASHBOARD_ROUTE}/`)) {
      const target = `${path.slice(DASHBOARD_ROUTE.length) || '/'}${search}`;
      return NextResponse.redirect(new URL(target, dashboardOrigin(origin.origin)));
    }
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
