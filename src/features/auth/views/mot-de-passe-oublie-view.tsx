'use client';

import { MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { authErrorKey, type AuthErrorKey } from '@/features/auth/lib/auth-errors';
import { authClient } from '@/features/auth/lib/auth-client';
import { resetPasswordRedirectTo } from '@/features/auth/lib/password-reset';
import { Link } from '@/i18n/navigation';

const linkClass = 'text-rouge font-semibold hover:underline';

/**
 * Mot de passe oublié: request a reset link by email. The confirmation is the
 * same whether or not the address has an Account, so the page never reveals
 * who is registered.
 */
export function MotDePasseOublieView(): ReactNode {
  const t = useTranslations('Auth.MotDePasseOublie');
  const tFields = useTranslations('Auth.Fields');
  const tErrors = useTranslations('Auth.Errors');
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: resetPasswordRedirectTo(locale),
    });
    setPending(false);

    if (requestError) {
      setError(authErrorKey(requestError));
      return;
    }
    setSentTo(email);
  }

  const footer = (
    <>
      {t('remembered')}{' '}
      <Link href="/connexion" className={linkClass}>
        {t('signIn')}
      </Link>
    </>
  );

  if (sentTo) {
    return (
      <AuthShell title={t('sentTitle')} subtitle={t('sentBody', { email: sentTo })}>
        <div className="flex flex-col items-center gap-4">
          <span className="bg-rouge/10 text-rouge inline-flex h-14 w-14 items-center justify-center rounded-full">
            <MailCheck aria-hidden={true} className="h-7 w-7" />
          </span>
          <Link href="/connexion" className={linkClass}>
            {t('backToSignIn')}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')} footer={footer}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{tErrors(error)}</AlertDescription>
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
          <Button
            type="submit"
            disabled={pending}
            className="bg-rouge hover:bg-rouge/90 h-11 w-full font-semibold text-white"
          >
            {pending ? t('submitting') : t('submit')}
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
