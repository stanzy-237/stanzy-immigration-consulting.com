import { prismaAdapter } from 'better-auth/adapters/prisma';
import { after } from 'next/server';

import { parseConsultantEmails } from '@/features/auth/lib/consultant-emails';
import { dashboardOrigin } from '@/features/dashboard/lib/dashboard-host';
import { env } from '@/lib/env';
import { prisma } from '@/server/db/client';
import { createAuth } from '@/server/auth/create-auth';
import { createMailer } from '@/server/email/mailer';

const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
// Previews are opened from the branch alias (`…-git-<branch>-….vercel.app`),
// not the per-deployment `VERCEL_URL`, so trust it too.
const vercelBranchOrigin = process.env.VERCEL_BRANCH_URL
  ? `https://${process.env.VERCEL_BRANCH_URL}`
  : undefined;

/**
 * The site answers on both the apex and `www` hosts, so trust both variants of
 * an origin; otherwise Better Auth rejects sign-in from the other host with
 * 403 INVALID_ORIGIN.
 */
function withWwwVariant(origin: string): string[] {
  const url = new URL(origin);
  if (url.hostname === 'localhost') return [url.origin];
  const host = url.hostname.startsWith('www.') ? url.hostname.slice(4) : `www.${url.hostname}`;
  return [url.origin, `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`];
}

/** The site's own hosts, plus admin.<site> where the Tableau de bord signs in. */
const siteOrigins = (origin: string): string[] => [...withWwwVariant(origin), dashboardOrigin(origin)];

/**
 * The app's Better Auth instance, wired to Neon through Prisma and to Resend.
 * Import this from server code only; the browser talks to it through
 * `@/features/auth/lib/auth-client`.
 */
export const auth = createAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  mailer: createMailer({
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM ?? 'Stanzy Immigration <onboarding@resend.dev>',
  }),
  // On previews, the branch alias: it is where people open the preview, and
  // it stays the same across pushes, so Google's redirect URI for it (which
  // Better Auth derives from baseURL) only has to be registered once.
  baseURL: env.BETTER_AUTH_URL ?? vercelBranchOrigin ?? vercelOrigin ?? 'http://localhost:3000',
  secret: env.BETTER_AUTH_SECRET,
  // Send auth emails after responding, so response time never reveals
  // whether an address has an Account.
  runInBackground: (task) => after(task),
  google:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined,
  consultantEmails: parseConsultantEmails(env.CONSULTANT_EMAILS).emails,
  cookieDomain: env.AUTH_COOKIE_DOMAIN,
  trustedOrigins: [
    // Locally (no BETTER_AUTH_URL, not on Vercel) that is localhost and admin.localhost.
    ...(env.BETTER_AUTH_URL
      ? siteOrigins(env.BETTER_AUTH_URL)
      : process.env.VERCEL
        ? []
        : siteOrigins('http://localhost:3000')),
    ...[vercelOrigin, vercelBranchOrigin].filter((origin): origin is string => Boolean(origin)),
  ],
});
