/**
 * The Tableau de bord lives on its own subdomain, `admin.<site>`, served by
 * the same app: the proxy maps its paths onto the `/[locale]/tableau-de-bord`
 * pages. Locally that is `admin.localhost:3000`.
 */
export const DASHBOARD_SUBDOMAIN = 'admin';

/** The dashboard pages' route inside the app, before the proxy shortens it. */
export const DASHBOARD_ROUTE = '/tableau-de-bord';

const PREFIX = `${DASHBOARD_SUBDOMAIN}.`;

export const isDashboardHost = (hostname: string): boolean => hostname.startsWith(PREFIX);

/** `https://www.site.com` → `https://admin.site.com` (the port is kept). */
export function dashboardOrigin(siteOrigin: string): string {
  const url = new URL(siteOrigin);
  url.hostname = `${PREFIX}${url.hostname.replace(/^www\./, '')}`;
  return url.origin;
}

/** `https://admin.site.com` → `https://site.com`. */
export function siteOriginOf(dashboardOrigin: string): string {
  const url = new URL(dashboardOrigin);
  url.hostname = url.hostname.slice(PREFIX.length);
  return url.origin;
}
