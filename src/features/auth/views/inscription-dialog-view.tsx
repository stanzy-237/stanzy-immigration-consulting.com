'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthDialog } from '@/features/auth/components/auth-dialog';
import { InscriptionForm } from '@/features/auth/components/inscription-form';
import { Link } from '@/i18n/navigation';

/**
 * Inscription opened over the current page (intercepted route). A successful
 * sign-up navigates to Vérification, which closes the dialog.
 */
export function InscriptionDialogView(): ReactNode {
  const t = useTranslations('Auth.Inscription');
  return (
    <AuthDialog
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/connexion" replace className="text-rouge font-semibold hover:underline">
            {t('signIn')}
          </Link>
        </>
      }
    >
      <InscriptionForm />
    </AuthDialog>
  );
}
