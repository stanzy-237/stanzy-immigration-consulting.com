'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { AuthShell } from '@/features/auth/components/auth-shell';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { Link } from '@/i18n/navigation';

/**
 * Compte: the signed-in Account's home. A placeholder for now, so protected
 * pages (Sécurité, later the Coffre-fort) have somewhere to live. The route's
 * layout guarantees a session; the Account is read client-side like the nav.
 */
export function CompteView(): ReactNode {
  const t = useTranslations('Auth.Compte');
  const { account } = useCurrentAccount();

  return (
    <AuthShell
      title={t('title')}
      subtitle={account ? t('signedInAs', { name: account.name, email: account.email }) : null}
    >
      <p className="text-navy-deep text-sm">{t('comingSoon')}</p>
      <Link
        href="/"
        className="bg-rouge hover:bg-rouge/90 mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
      >
        {t('backHome')}
      </Link>
    </AuthShell>
  );
}
