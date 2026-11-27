import { DashboardMoreView } from '@/features/dashboard/views/dashboard-more-view';
import type { LocaleParams } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

// « Plus » (phones): every section without its own tab, with what waits in each.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  prefetch(trpc.overview.today.queryOptions());
  return (
    <HydrateClient>
      <DashboardMoreView siteUrl={`${siteUrl()}/${locale}`} />
    </HydrateClient>
  );
}
