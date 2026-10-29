import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DrawsView } from '@/features/draws/views/draws-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, publicTrpc } from '@/trpc/server';

// Static with the Tirages in its HTML, refreshed every 5 minutes; the browser
// also refetches them when they're older than 30 s.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Draws' });
  return { title: t('metaTitle') };
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  prefetch(publicTrpc.draws.latest.queryOptions({ take: 1 }));
  prefetch(publicTrpc.draws.list.queryOptions());
  return (
    <HydrateClient>
      <DrawsView />
    </HydrateClient>
  );
}
