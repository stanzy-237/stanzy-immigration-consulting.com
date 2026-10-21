'use client';

import { useLocale } from 'next-intl';
import { useCallback, useState } from 'react';

import type { AuthClientError } from '@/features/auth/lib/auth-errors';
import { authClient } from '@/features/auth/lib/auth-client';
import { verifiedCallbackURL } from '@/features/auth/lib/verification';

/**
 * Re-sends the verification email for `email`. `resent` flips to true once
 * the email has gone out; `resend` resolves to the error, if any.
 */
export function useResendVerification(email: string | undefined): {
  resent: boolean;
  resend: () => Promise<AuthClientError | null>;
  reset: () => void;
} {
  const locale = useLocale();
  const [resent, setResent] = useState(false);

  const resend = useCallback(async (): Promise<AuthClientError | null> => {
    if (!email) return null;
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: verifiedCallbackURL(locale),
    });
    if (error) return error;
    setResent(true);
    return null;
  }, [email, locale]);

  const reset = useCallback((): void => setResent(false), []);

  return { resent, resend, reset };
}
