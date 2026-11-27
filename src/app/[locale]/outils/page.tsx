import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolsView } from '@/features/landing/views/tools-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, publicTrpc } from '@/trpc/server';
import { shareMetadata } from '@/lib/share-metadata';

// Static with the latest Tirage in its HTML, refreshed every 5 minutes (like the home page).
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.ToolsGrid' });
  return shareMetadata({ locale, path: '/outils', card: 'outils', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // The phone's « Dernier tirage » card.
  prefetch(publicTrpc.draws.latest.queryOptions({ take: 4 }));
  return (
    <HydrateClient>
      <ToolsView />
    </HydrateClient>
  );
}
