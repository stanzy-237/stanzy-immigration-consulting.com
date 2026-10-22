'use client';

import { LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { authErrorKey, type AuthErrorKey } from '@/features/auth/lib/auth-errors';
import { authClient } from '@/features/auth/lib/auth-client';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/lib/password';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * The page's query string, as Better Auth sets it when the emailed link is
 * followed: `token` for a live link, `error=INVALID_TOKEN` for a used or
 * expired one.
 */
export type ReinitialiserMotDePasseSearchParams = Record<
  string,
  string | string[] | undefined
>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * Réinitialiser le mot de passe: choose a new password from an emailed link.
 * Better Auth revokes every session and this app then signs the person in.
 */
export function ReinitialiserMotDePasseView({
  searchParams,
}: {
  searchParams: ReinitialiserMotDePasseSearchParams;
}): ReactNode {
  const t = useTranslations('Auth.ReinitialiserMotDePasse');
  const tFields = useTranslations('Auth.Fields');
  const tErrors = useTranslations('Auth.Errors');
  const router = useRouter();
  const hintId = useId();
  const vaultTitleId = useId();

  const token = first(searchParams.token);
  const [linkDead, setLinkDead] = useState(!token || Boolean(first(searchParams.error)));
  const [password, setPassword] = useState('');
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordInvalid(true);
      return;
    }

    setPending(true);
    setError(null);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);

    if (resetError) {
      if (resetError.code === 'INVALID_TOKEN') setLinkDead(true);
      else setError(authErrorKey(resetError));
      return;
    }
    // The server set a new session cookie; tell the client's session store
    // (the nav reads it) to fetch it, as it does after a sign-in.
    authClient.$store.notify('$sessionSignal');
    router.push('/');
  }

  if (linkDead) {
    return (
      <AuthShell title={t('invalidTitle')} subtitle={t('invalidBody')}>
        <Link
          href="/mot-de-passe-oublie"
          className="bg-rouge hover:bg-rouge/90 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
        >
          {t('requestNew')}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <section
            aria-labelledby={vaultTitleId}
            className="border-steel-blue/30 bg-ice-blue/40 flex gap-3 rounded-lg border p-3"
          >
            <LockKeyhole aria-hidden={true} className="text-navy-deep mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              <h2 id={vaultTitleId} className="text-navy-deep font-semibold">
                {t('vaultTitle')}
              </h2>
              <p className="text-slate mt-1">{t('vaultBody')}</p>
            </div>
          </section>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{tErrors(error)}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="new-password">{t('newPassword')}</FieldLabel>
            <Input
              id="new-password"
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
            <FieldDescription id={hintId} className={cn(passwordInvalid && 'text-destructive')}>
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
