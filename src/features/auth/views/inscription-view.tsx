'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { InscriptionForm } from '@/features/auth/components/inscription-form';
import { withNext, type NextParam } from '@/features/auth/lib/safe-next-path';
import { Link } from '@/i18n/navigation';

/** Inscription as a full page: opened directly, or on refresh. */
export function InscriptionView({ next }: { next?: NextParam }): ReactNode {
  const t = useTranslations('Auth.Inscription');
  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href={withNext('/connexion', next)} className="text-rouge font-semibold hover:underline">
            {t('signIn')}
          </Link>
        </>
      }
    >
      <InscriptionForm />
    </AuthShell>
  );
}
