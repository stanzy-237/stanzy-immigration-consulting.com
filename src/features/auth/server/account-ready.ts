import { randomBytes } from 'node:crypto';

import { after } from 'next/server';

import { accountReadyEmail, resetPasswordEmail } from '@/features/auth/lib/emails';
import { resetPasswordRedirectTo } from '@/features/auth/lib/password-reset';
import { toLocale } from '@/i18n/routing';
import type { prisma as appPrisma } from '@/server/db/client';
import { accountMailer } from '@/server/email/app-mailer';

type Db = Pick<typeof appPrisma, 'account' | 'authIdentity'>;

/** How long « Créer mon mot de passe » from the booking e-mail works. */
export const SET_PASSWORD_LINK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the Account can sign in with a password (a booking creates one without). */
export async function hasPassword(db: Db, accountId: string): Promise<boolean> {
  const identity = await db.authIdentity.findFirst({ where: { userId: accountId, providerId: 'credential' }, select: { password: true } });
  return Boolean(identity?.password);
}

/**
 * A link that sets the Account's password: Better Auth's reset link, which
 * creates the password when there is none, landing on « Créez votre mot de
 * passe » (`?nouveau=1`) and signing them in.
 */
export async function setPasswordUrl(accountId: string, locale: string, ttlMs: number): Promise<string> {
  const { auth } = await import('@/server/auth/auth');
  const context = await auth.$context;
  const token = randomBytes(24).toString('base64url');
  await context.internalAdapter.createVerificationValue({
    value: accountId,
    identifier: `reset-password:${token}`,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  const callbackURL = encodeURIComponent(`${resetPasswordRedirectTo(locale)}?nouveau=1`);
  return `${context.baseURL}/reset-password/${token}?callbackURL=${callbackURL}`;
}

/**
 * After a Consultation is paid: an Account made at booking (no password yet)
 * gets « Votre compte est prêt » with « Créer mon mot de passe ». Sent after
 * the response; a failure is logged, never thrown.
 */
export function sendAccountReadyLater(db: Db, accountId: string): void {
  const send = async () => {
    try {
      if (await hasPassword(db, accountId)) return;
      const account = await db.account.findUnique({ where: { id: accountId }, select: { name: true, email: true, locale: true } });
      if (!account) return;
      const locale = toLocale(account.locale);
      const url = await setPasswordUrl(accountId, locale, SET_PASSWORD_LINK_DAYS * DAY_MS);
      await accountMailer.send(accountReadyEmail({ to: account.email, name: account.name, locale, url, days: SET_PASSWORD_LINK_DAYS }));
    } catch (error) {
      console.error('[account] could not send « Votre compte est prêt »', error);
    }
  };
  try {
    after(send);
  } catch {
    void send();
  }
}

/** « Créer » from Mon compte when the session is too old to set it directly: the same link, for 1 hour. */
export async function sendSetPasswordLink(account: { id: string; name: string; email: string; locale: string | null }): Promise<void> {
  const locale = toLocale(account.locale);
  const url = await setPasswordUrl(account.id, locale, 60 * 60 * 1000);
  await accountMailer.send(resetPasswordEmail({ to: account.email, name: account.name, locale, url }));
}
