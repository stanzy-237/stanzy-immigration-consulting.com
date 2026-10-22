'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthDialog } from '@/features/auth/components/auth-dialog';
import { ConnexionForm } from '@/features/auth/components/connexion-form';
import { localizedNextPath, safeNextPath, withNext, type NextParam } from '@/features/auth/lib/safe-next-path';
import { GoogleSignIn } from '@/features/auth/components/google-sign-in';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * Connexion opened over the current page (intercepted route). Signing in
 * closes the dialog and leaves the person where they were, now signed in;
 * or, when opened with `?next=` (e.g. a client-side visit to a protected
 * page), goes on to `next`.
 */
export function ConnexionDialogView({ next }: { next?: NextParam }): ReactNode {
  const t = useTranslations('Auth.Connexion');
  const locale = useLocale();
  const router = useRouter();

  return (
    <AuthDialog
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link
            href={withNext('/inscription', next)}
            replace
            className="text-rouge font-semibold hover:underline"
          >
            {t('signUp')}
          </Link>
        </>
      }
    >
      {/* Google is a full-page round-trip, so it can't return to the page under
          the dialog; it lands on `next`, or home without one. */}
      <GoogleSignIn callbackURL={localizedNextPath(locale, next)} />
      {/* No router.refresh(): pages are static and the nav updates from the
          session on its own; a refresh would re-render the page underneath. */}
      <ConnexionForm
        onSignedIn={(): void => {
          if (next === undefined) router.back();
          else router.replace(safeNextPath(next));
        }}
      />
    </AuthDialog>
  );
}
