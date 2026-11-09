import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MyServicesView } from '@/features/document-services/views/my-services-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string }>;
type Search = Promise<{ document?: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'DocumentServices.mine' });
  return { title: t('title'), robots: { index: false } };
}

// Signed in only, and its prices for Clients in Cameroon: the procedure decides (ADR 0005).
export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale } = await params;
  const { document } = await searchParams;
  setRequestLocale(locale);
  await requireSession({ locale, next: '/mon-espace/services' });
  prefetch(trpc.documentServices.list.queryOptions());
  prefetch(trpc.documentServices.requirements.mine.queryOptions());
  return (
    <HydrateClient>
      <MyServicesView documentId={document ?? null} />
    </HydrateClient>
  );
}
