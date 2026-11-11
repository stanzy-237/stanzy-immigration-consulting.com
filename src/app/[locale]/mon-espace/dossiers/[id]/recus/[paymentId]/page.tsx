import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { ReceiptSignView } from '@/features/invoices/views/receipt-sign-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string; paymentId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Invoices.receiptSign' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// Only the Client holding the Dossier signs; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id, paymentId } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/dossiers/${id}/recus/${paymentId}` });
  prefetch(trpc.invoices.payments.get.queryOptions({ id: paymentId }));
  return (
    <HydrateClient>
      <ReceiptSignView dossierId={id} paymentId={paymentId} />
    </HydrateClient>
  );
}
