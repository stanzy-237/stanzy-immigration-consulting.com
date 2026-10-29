import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ItaCountdownView } from '@/features/ita-countdown/views/ita-countdown-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, publicTrpc } from '@/trpc/server';

// Static; the « Derniers tirages » shortcut's Tirages are in its HTML, refreshed every 5 minutes.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'Home.ToolsGrid.Items',
  });
  return { title: t('itaName') };
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  prefetch(publicTrpc.draws.latest.queryOptions({ take: 5 }));
  return (
    <HydrateClient>
      <ItaCountdownView />
    </HydrateClient>
  );
}
