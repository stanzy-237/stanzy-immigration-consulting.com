import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CompteView } from '@/features/auth/views/compte-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Compte' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// « Mon compte »: the layout guarantees a session.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  prefetch(trpc.account.settings.queryOptions());
  return (
    <HydrateClient>
      <CompteView />
    </HydrateClient>
  );
}
