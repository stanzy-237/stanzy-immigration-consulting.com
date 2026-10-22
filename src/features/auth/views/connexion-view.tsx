'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { ConnexionForm } from '@/features/auth/components/connexion-form';
import { safeNextPath, withNext, type NextParam } from '@/features/auth/lib/safe-next-path';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * Connexion as a full page: opened directly, on refresh, or after the proxy
 * sent a signed-out visitor here. `next` (from `?next=`, untrusted) is where
 * they go once signed in; home when absent or unsafe.
 */
export function ConnexionView({ next }: { next?: NextParam }): ReactNode {
  const t = useTranslations('Auth.Connexion');
  const router = useRouter();

  return (
    <AuthShell
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href={withNext('/inscription', next)} className="text-rouge font-semibold hover:underline">
            {t('signUp')}
          </Link>
        </>
      }
    >
      <ConnexionForm onSignedIn={(): void => router.push(safeNextPath(next))} />
    </AuthShell>
  );
}
