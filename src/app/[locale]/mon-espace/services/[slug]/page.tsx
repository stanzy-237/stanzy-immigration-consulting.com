import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MyServiceView } from '@/features/document-services/views/my-service-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; slug: string }>;
type Search = Promise<{ document?: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'DocumentServices.mine' });
  return { title: t('title'), robots: { index: false } };
}

// Signed in only; the procedure answers NOT_FOUND for an inactive service (ADR 0005).
export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, slug } = await params;
  const { document } = await searchParams;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/services/${slug}` });
  prefetch(trpc.documentServices.get.queryOptions({ slug, documentId: document ?? null }));
  return (
    <HydrateClient>
      <MyServiceView slug={slug} documentId={document ?? null} />
    </HydrateClient>
  );
}
