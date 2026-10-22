'use client';

import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldSeparator } from '@/components/ui/field';
import { authClient } from '@/features/auth/lib/auth-client';

type GoogleErrorKey = 'failed' | 'accountNotLinked';

/**
 * Inlined at build time by `next.config.ts`: "true" when the server has a
 * Google OAuth client configured. Without one the button is not shown.
 */
function isGoogleSignInEnabled(): boolean {
  return process.env.GOOGLE_SIGN_IN_ENABLED === 'true';
}

/**
 * "Continuer avec Google", followed by an "ou" separator before the email
 * form. A full-page redirect (never a popup) so it also works inside the
 * installed PWA. Google sends the person back to `callbackURL`; on failure
 * Better Auth sends them to Connexion with `?error=…`, shown here.
 */
export function GoogleSignIn({ callbackURL }: { callbackURL: string }): ReactNode {
  const t = useTranslations('Auth.Google');
  const locale = useLocale();
  const [error, setError] = useState<GoogleErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  // Coming back from Google with the Back button restores this page from the
  // back/forward cache, still "redirecting"; make the button usable again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent): void => {
      if (e.persisted) setPending(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  if (!isGoogleSignInEnabled()) return null;

  async function onClick(): Promise<void> {
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      errorCallbackURL: `/${locale}/connexion`,
    });
    // On success the browser is already leaving for Google; stay pending.
    if (signInError) {
      setPending(false);
      setError('failed');
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${error}`)}</AlertDescription>
        </Alert>
      ) : (
        // useSearchParams needs a Suspense boundary on statically rendered pages.
        <Suspense fallback={null}>
          <ReturnedError />
        </Suspense>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onClick}
        className="border-fog text-navy-deep hover:bg-off-white h-11 w-full gap-3 font-semibold"
      >
        <GoogleLogo />
        {pending ? t('redirecting') : t('continue')}
      </Button>
      <FieldSeparator>{t('or')}</FieldSeparator>
    </div>
  );
}

/** The `?error=` Better Auth adds when the Google round-trip fails. */
function ReturnedError(): ReactNode {
  const t = useTranslations('Auth.Google');
  const code = useSearchParams()?.get('error');
  if (!code) return null;
  const key: GoogleErrorKey = code === 'account_not_linked' ? 'accountNotLinked' : 'failed';
  return (
    <Alert variant="destructive">
      <AlertDescription>{t(`errors.${key}`)}</AlertDescription>
    </Alert>
  );
}

/** Google's "G" mark, in its required brand colours. */
function GoogleLogo(): ReactNode {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
