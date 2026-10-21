import { betterAuth, type BetterAuthOptions } from 'better-auth';

import { verificationEmail } from '@/features/auth/lib/emails';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/lib/password';
import { toLocale } from '@/i18n/routing';
import type { Mailer } from '@/server/email/mailer';

export type AuthDeps = {
  database: BetterAuthOptions['database'];
  mailer: Mailer;
  baseURL: string;
  secret: string;
  trustedOrigins?: string[];
};

/**
 * Builds the Better Auth instance from its dependencies. Production wires the
 * Prisma adapter and the Resend mailer (see `./auth`); tests wire an in-memory
 * adapter and a recording mailer.
 *
 * Naming: Better Auth's `user` model is our glossary **Account** (one person's
 * login), so it is stored as `account`. Better Auth's own `account` model —
 * one row per linked sign-in method — is renamed `authIdentity` so the two
 * never get confused.
 */
export function createAuth(deps: AuthDeps) {
  return betterAuth({
    appName: 'Stanzy Immigration Consulting',
    baseURL: deps.baseURL,
    secret: deps.secret,
    trustedOrigins: deps.trustedOrigins,
    database: deps.database,
    user: {
      modelName: 'account',
      additionalFields: {
        // The language the Account signed up in; drives email copy.
        locale: { type: 'string', required: false, defaultValue: 'fr', input: true },
      },
    },
    account: { modelName: 'authIdentity' },
    emailAndPassword: {
      enabled: true,
      // Also makes sign-up answer identically for new and existing emails, so
      // the response never confirms that an address is registered.
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        await deps.mailer.send(
          verificationEmail({
            to: user.email,
            name: user.name,
            url,
            locale: (user as { locale?: unknown }).locale,
          }),
        );
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            return { data: { ...user, locale: toLocale(user.locale) } };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      // Database-backed so limits hold across serverless instances.
      storage: 'database',
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
