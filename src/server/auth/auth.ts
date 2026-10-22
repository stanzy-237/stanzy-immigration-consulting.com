import { prismaAdapter } from 'better-auth/adapters/prisma';

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
  baseURL: env.BETTER_AUTH_URL ?? vercelOrigin ?? 'http://localhost:3000',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    ...(env.BETTER_AUTH_URL ? withWwwVariant(env.BETTER_AUTH_URL) : []),
    ...[vercelOrigin, vercelBranchOrigin].filter((origin): origin is string => Boolean(origin)),
  ],
});
