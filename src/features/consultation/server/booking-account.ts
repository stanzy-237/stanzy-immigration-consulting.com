import { verifiedCallbackURL } from '@/features/auth/lib/verification';

/**
 * Booking step 1 for someone signed out (docs/design/consultation.md, Booking):
 * creates their Compte with no password, unverified, and sends the usual
 * Vérification e-mail. Following it confirms the address and signs them in;
 * until then the booking is reached only through the browser's hold secret,
 * never a session, so typing someone else's e-mail gives no access to it.
 * Created through Better Auth, so its hooks run (locale, consultant role).
 * `auth` loads only when a Compte is made, keeping it out of every router import.
 */
export async function createBookingAccount(input: {
  name: string;
  email: string;
  locale: 'fr' | 'en';
  /** Where the verification link leads back to: the booking. */
  next: string;
}): Promise<{ id: string }> {
  const { auth } = await import('@/server/auth/auth');
  const context = await auth.$context;
  const account = await context.internalAdapter.createUser(
    { name: input.name, email: input.email, emailVerified: false, locale: input.locale },
    { method: 'email-password' },
  );
  await auth.api.sendVerificationEmail({
    body: { email: input.email, callbackURL: verifiedCallbackURL(input.locale, input.next) },
  });
  return { id: account.id };
}
