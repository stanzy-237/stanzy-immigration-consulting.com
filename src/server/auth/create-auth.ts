import { betterAuth, type BetterAuthOptions, type User } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';

import { resetPasswordEmail, verificationEmail } from '@/features/auth/lib/emails';
import {
  MIN_PASSWORD_LENGTH,
  RESET_PASSWORD_LINK_TTL_SECONDS,
} from '@/features/auth/lib/password';
import { toLocale } from '@/i18n/routing';
import type { Mailer } from '@/server/email/mailer';

export type AuthDeps = {
  database: BetterAuthOptions['database'];
  mailer: Mailer;
  baseURL: string;
  secret: string;
  trustedOrigins?: string[];
  /**
   * Runs a task (sending an auth email) after the response. Without it the
   * email is awaited, so a request for a registered address answers slower
   * than one for an unknown address. Tests leave it out to see the email.
   */
  runInBackground?: (task: Promise<unknown>) => void;
  /** Google OAuth client. Without it, "Continuer avec Google" is off. */
  google?: { clientId: string; clientSecret: string };
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
  // Better Auth resets the password but issues no session. The Account whose
  // password a request just reset is remembered here (per request) so the
  // `after` hook below can sign that person in.
  const passwordResetFor = new WeakMap<Request, User>();

  /** Emails `user` a link, in the language their Account signed up in. */
  const sendLinkEmail =
    (build: typeof verificationEmail) =>
    async ({ user, url }: { user: User; url: string }): Promise<void> => {
      await deps.mailer.send(
        build({
          to: user.email,
          name: user.name,
          url,
          locale: (user as { locale?: unknown }).locale,
        }),
      );
    };

  return betterAuth({
    appName: 'Stanzy Immigration Consulting',
    baseURL: deps.baseURL,
    secret: deps.secret,
    trustedOrigins: deps.trustedOrigins,
    database: deps.database,
    advanced: deps.runInBackground
      ? { backgroundTasks: { handler: deps.runInBackground } }
      : undefined,
    user: {
      modelName: 'account',
      additionalFields: {
        // The language the Account signed up in; drives email copy.
        locale: { type: 'string', required: false, defaultValue: 'fr', input: true },
      },
    },
    account: {
      modelName: 'authIdentity',
      accountLinking: {
        enabled: true,
        // A Google sign-in whose email matches an existing Account joins it
        // instead of creating a second one. Better Auth still refuses when the
        // existing Account's email was never verified, so nobody can pre-claim
        // an address with a password and wait for its owner to use Google.
        trustedProviders: ['google'],
      },
    },
    socialProviders: deps.google
      ? {
          google: {
            clientId: deps.google.clientId,
            clientSecret: deps.google.clientSecret,
            // Let people with several Google accounts pick the right one.
            prompt: 'select_account',
          },
        }
      : {},
    emailAndPassword: {
      enabled: true,
      // Also makes sign-up answer identically for new and existing emails, so
      // the response never confirms that an address is registered.
      requireEmailVerification: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      // Whoever knew the old password is signed out everywhere. The cookie
      // cache below can keep a revoked device's session readable for up to
      // 5 minutes; the database no longer accepts it.
      revokeSessionsOnPasswordReset: true,
      // The reset email tells the person the link lasts 1 hour.
      resetPasswordTokenExpiresIn: RESET_PASSWORD_LINK_TTL_SECONDS,
      sendResetPassword: sendLinkEmail(resetPasswordEmail),
      async onPasswordReset({ user }, request) {
        if (request) passwordResetFor.set(request, user);
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/reset-password' || !ctx.request) return;
        const user = passwordResetFor.get(ctx.request);
        if (!user) return;
        // Following a link sent to the address proves it as well as the
        // verification link would, so an unverified Account is verified here
        // rather than signed in half-way.
        const account = user.emailVerified
          ? user
          : await ctx.context.internalAdapter.updateUser(user.id, { emailVerified: true });
        // TOTP (#4, stories 27-28): once an Account can enable 2FA, this must
        // not mint a full session for it; send it through the 2FA challenge
        // instead, or an emailed link alone would bypass the second factor.
        const session = await ctx.context.internalAdapter.createSession(account.id);
        await setSessionCookie(ctx, { session, user: account });
      }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: sendLinkEmail(verificationEmail),
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
        // Mot de passe oublié: each request sends an email.
        '/request-password-reset': { window: 60, max: 3 },
        // Every page's nav reads the session; limiting a read protects
        // nothing and costs several database round trips per page view.
        '/get-session': false,
      },
    },
    session: {
      // Keep the session in a signed cookie for 5 minutes so most session
      // reads skip the database. Trade-off: a session revoked elsewhere stays
      // usable here for up to 5 minutes.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
