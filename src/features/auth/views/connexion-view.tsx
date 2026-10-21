'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { ConnexionForm } from '@/features/auth/components/connexion-form';
import { Link, useRouter } from '@/i18n/navigation';

/** Connexion as a full page: opened directly, or on refresh. */
export function ConnexionView(): ReactNode {
  const t = useTranslations('Auth.Connexion');
  const router = useRouter();

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/inscription" className="text-rouge font-semibold hover:underline">
            {t('signUp')}
          </Link>
        </>
      }
    >
      <ConnexionForm
        onSignedIn={(): void => {
          router.push('/');
          router.refresh();
        }}
      />
    </AuthShell>
  );
}
