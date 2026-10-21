'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { authErrorKey, type AuthErrorKey } from '@/features/auth/lib/auth-errors';
import { authClient } from '@/features/auth/lib/auth-client';
import { verifiedCallbackURL } from '@/features/auth/lib/verification';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/lib/password';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** Inscription: create an Account with email + password. */
export function InscriptionView(): ReactNode {
  const t = useTranslations('Auth.Inscription');
  const tFields = useTranslations('Auth.Fields');
  const tErrors = useTranslations('Auth.Errors');
  const locale = useLocale();
  const router = useRouter();
  const hintId = useId();

  const [password, setPassword] = useState('');
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordInvalid(true);
      return;
    }
    const email = String(form.get('email'));

    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get('name')),
      email,
      password,
      locale,
      callbackURL: verifiedCallbackURL(locale),
    });
    setPending(false);

    if (signUpError) {
      setError(authErrorKey(signUpError));
      return;
    }
    router.push({ pathname: '/verification', query: { email } });
  }

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/connexion" className="text-rouge font-semibold hover:underline">
            {t('signIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{tErrors(error)}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="name">{tFields('name')}</FieldLabel>
            <Input id="name" name="name" autoComplete="name" required className="h-11" />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">{tFields('email')}</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-11"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{tFields('password')}</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e): void => {
                setPassword(e.target.value);
                if (e.target.value.length >= MIN_PASSWORD_LENGTH) setPasswordInvalid(false);
              }}
              aria-invalid={passwordInvalid}
              aria-describedby={hintId}
              className="h-11"
            />
            <FieldDescription
              id={hintId}
              className={cn(passwordInvalid && 'text-destructive')}
            >
              {tFields('passwordHint', { min: MIN_PASSWORD_LENGTH })}
            </FieldDescription>
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
