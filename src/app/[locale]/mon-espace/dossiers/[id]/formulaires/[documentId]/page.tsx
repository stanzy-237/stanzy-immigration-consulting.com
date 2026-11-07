import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { ClientFormView } from '@/features/client-forms/views/client-form-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string; documentId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ClientForms' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// Only the Dossier's own Client reaches it; the procedure answers NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id, documentId } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/dossiers/${id}/formulaires/${documentId}` });
  prefetch(trpc.clientForms.get.queryOptions({ documentId }));
  return (
    <HydrateClient>
      <ClientFormView documentId={documentId} viewer="client" />
    </HydrateClient>
  );
}
