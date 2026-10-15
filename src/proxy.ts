import createMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

// Next 16 renamed the Middleware convention to Proxy; next-intl's handler is
// wired in here as the default export.
export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for Next internals, API routes and files with an
  // extension (favicon, manifest, service worker, static assets, …).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
