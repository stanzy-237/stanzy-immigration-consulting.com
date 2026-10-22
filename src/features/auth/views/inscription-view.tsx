'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { GoogleSignIn } from '@/features/auth/components/google-sign-in';
import { InscriptionForm } from '@/features/auth/components/inscription-form';
import { localizedNextPath, withNext, type NextParam } from '@/features/auth/lib/safe-next-path';
import { Link } from '@/i18n/navigation';

/** Inscription as a full page: opened directly, or on refresh. */
export function InscriptionView({ next }: { next?: NextParam }): ReactNode {
  const t = useTranslations('Auth.Inscription');
  const locale = useLocale();
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
      <GoogleSignIn callbackURL={localizedNextPath(locale, next)} />
      <InscriptionForm />
    </AuthShell>
  );
}
