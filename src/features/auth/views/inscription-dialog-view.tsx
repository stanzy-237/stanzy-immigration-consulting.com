'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useGuestPage } from '@/features/auth/hooks/use-guest-page';
import { AuthDialog } from '@/features/auth/components/auth-dialog';
import { GoogleSignIn } from '@/features/auth/components/google-sign-in';
import { InscriptionForm } from '@/features/auth/components/inscription-form';
import { localizedNextPath, withNext, type NextParam } from '@/features/auth/lib/safe-next-path';
import { Link } from '@/i18n/navigation';

/**
 * Inscription opened over the current page (intercepted route). A successful
 * sign-up navigates to Vérification, which closes the dialog.
 */
export function InscriptionDialogView({ next: nextProp }: { next?: NextParam }): ReactNode {
  const { next } = useGuestPage(nextProp);
  const t = useTranslations('Auth.Inscription');
  const locale = useLocale();
  return (
    <AuthDialog
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href={withNext('/connexion', next)} replace className="text-rouge font-semibold hover:underline">
            {t('signIn')}
          </Link>
        </>
      }
    >
      <GoogleSignIn callbackURL={localizedNextPath(locale, next)} />
      <InscriptionForm next={next} />
    </AuthDialog>
  );
}
