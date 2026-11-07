import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { RequirementsView } from '@/features/document-services/views/requirements-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; requestId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'DocumentServices.requirements' });
  return { title: t('title'), robots: { index: false } };
}

// Signed in only; the procedure answers NOT_FOUND to anyone but the Dossier's Client and the consultant (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, requestId } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/services/demandes/${requestId}` });
  prefetch(trpc.documentServices.requirements.get.queryOptions({ requestId }));
  return (
    <HydrateClient>
      <RequirementsView requestId={requestId} viewer="client" />
    </HydrateClient>
  );
}
