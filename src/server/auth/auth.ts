import { prismaAdapter } from 'better-auth/adapters/prisma';

import { env } from '@/lib/env';
import { prisma } from '@/server/db/client';
import { createAuth } from '@/server/auth/create-auth';
import { createMailer } from '@/server/email/mailer';

const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

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
  trustedOrigins: [env.BETTER_AUTH_URL, vercelOrigin].filter(
    (origin): origin is string => Boolean(origin),
  ),
});
