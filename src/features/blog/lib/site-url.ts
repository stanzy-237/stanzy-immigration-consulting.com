/** The site's public origin for canonical and share addresses, without a trailing slash. */
export function siteUrl(): string {
  const configured =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  return (configured ?? 'http://localhost:3000').replace(/\/+$/, '');
}
