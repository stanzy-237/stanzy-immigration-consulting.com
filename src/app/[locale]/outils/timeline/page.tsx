import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { ParcoursView } from '@/features/parcours/views/parcours-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';
import { shareMetadata } from '@/lib/share-metadata';

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
  return shareMetadata({ locale, path: '/outils/timeline', card: 'timeline', title: t('timelineName'), description: t('timelineDesc') });
}

// A Parcours is private to its Account (ADR 0005: one guard call in the shell).
export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: '/outils/timeline' });
  prefetch(trpc.parcours.list.queryOptions());
  return (
    <HydrateClient>
      <ParcoursView />
    </HydrateClient>
  );
}
