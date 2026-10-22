'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useResendVerification } from '@/features/auth/hooks/use-resend-verification';
import { authErrorKey, type AuthErrorKey } from '@/features/auth/lib/auth-errors';
import { authClient } from '@/features/auth/lib/auth-client';
import { Link } from '@/i18n/navigation';

/**
 * Email + password sign-in. Shared by the Connexion page and the Connexion
 * dialog; each decides where the person goes once signed in.
 */
export function ConnexionForm({ onSignedIn }: { onSignedIn: () => void }): ReactNode {
  const t = useTranslations('Auth.Connexion');
  const tFields = useTranslations('Auth.Fields');
  const tErrors = useTranslations('Auth.Errors');

  const [email, setEmail] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  const { resent, resend, reset: resetResent } = useResendVerification(email);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    setPending(true);
    setError(null);
    resetResent();
    const { error: signInError } = await authClient.signIn.email({
      email,
      password: String(form.get('password')),
    });
    setPending(false);

    if (signInError) {
      setError(authErrorKey(signInError));
      return;
    }
    onSignedIn();
  }

  async function onResend(): Promise<void> {
    const resendError = await resend();
    if (resendError) setError(authErrorKey(resendError));
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {tErrors(error)}
              {error === 'emailNotVerified' ? (
                resent ? (
                  <span className="text-navy-deep mt-2 block">{t('resent')}</span>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    onClick={onResend}
                    className="text-rouge mt-1 h-auto p-0 font-semibold"
                  >
                    {t('resend')}
                  </Button>
                )
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <FieldLabel htmlFor="email">{tFields('email')}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e): void => setEmail(e.target.value)}
            className="h-11"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{tFields('password')}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11"
          />
          <p className="text-right text-sm">
            <Link href="/mot-de-passe-oublie" className="text-rouge font-semibold hover:underline">
              {t('forgotPassword')}
            </Link>
          </p>
        </Field>
        <Button
          type="submit"
          disabled={pending}
          className="bg-rouge hover:bg-rouge/90 h-11 w-full font-semibold text-white"
        >
          {pending ? t('submitting') : t('submit')}
        </Button>
      </FieldGroup>
    </form>
  );
}
