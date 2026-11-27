import { getTranslations, setRequestLocale } from 'next-intl/server';

import { HomeView } from '@/features/landing/views/home-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, publicTrpc } from '@/trpc/server';
import { shareMetadata } from '@/lib/share-metadata';

// Static with the latest Tirages and Articles in its HTML, refreshed every 5 minutes.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  const meta = await getTranslations({ locale, namespace: 'Metadata' });
  return shareMetadata({ locale, path: '', card: 'accueil', title: meta('title'), description: t('Hero.subtitle') });
}

export default async function HomePage({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The « Derniers tirages » section's four Tirages.
  prefetch(publicTrpc.draws.latest.queryOptions({ take: 4 }));
  return (
    <HydrateClient>
      <HomeView locale={locale} />
    </HydrateClient>
  );
}
