'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthDialog } from '@/features/auth/components/auth-dialog';
import { ConnexionForm } from '@/features/auth/components/connexion-form';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * Connexion opened over the current page (intercepted route). Signing in
 * closes the dialog and leaves the person where they were, now signed in.
 */
export function ConnexionDialogView(): ReactNode {
  const t = useTranslations('Auth.Connexion');
  const router = useRouter();

  return (
    <AuthDialog
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/inscription" replace className="text-rouge font-semibold hover:underline">
            {t('signUp')}
          </Link>
        </>
      }
    >
      <ConnexionForm
        onSignedIn={(): void => {
          router.back();
          router.refresh();
        }}
      />
    </AuthDialog>
  );
}
