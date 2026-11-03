import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { SignView } from '@/features/signatures/views/sign-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string; requestId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Signatures.sign' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// Only the Client holding the Dossier signs; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id, requestId } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/dossiers/${id}/signer/${requestId}` });
  prefetch(trpc.signatures.get.queryOptions({ id: requestId }));
  return (
    <HydrateClient>
      <SignView dossierId={id} requestId={requestId} />
    </HydrateClient>
  );
}
