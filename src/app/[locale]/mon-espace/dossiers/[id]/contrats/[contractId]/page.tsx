import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { ContractSignView } from '@/features/contracts/views/contract-sign-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string; contractId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Contracts.sign' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// Only the Client holding the Dossier signs; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id, contractId } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/dossiers/${id}/contrats/${contractId}` });
  prefetch(trpc.contracts.get.queryOptions({ id: contractId }));
  return (
    <HydrateClient>
      <ContractSignView dossierId={id} contractId={contractId} />
    </HydrateClient>
  );
}
