import { getTranslations, setRequestLocale } from 'next-intl/server';

import { headers } from 'next/headers';

import { CompteView } from '@/features/auth/views/compte-view';
import { VisitorAccountView } from '@/features/auth/views/visitor-account-view';
import { getCurrentSession } from '@/server/auth/session';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Compte' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// « Mon compte » signed in; « Compte » for a visitor (`PWA · Visiteur · 3 Compte`).
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentSession(await headers()))) return <VisitorAccountView />;
  prefetch(trpc.account.settings.queryOptions());
  return (
    <HydrateClient>
      <CompteView />
    </HydrateClient>
  );
}
