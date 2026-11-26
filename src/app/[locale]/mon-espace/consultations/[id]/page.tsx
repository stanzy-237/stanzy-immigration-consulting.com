import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MyConsultationView } from '@/features/consultation/views/my-consultation-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Consultation.space' });
  return { title: t('detailTitle'), robots: { index: false } };
}

// Its Account only; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/consultations/${id}` });
  prefetch(trpc.consultationSpace.detail.queryOptions({ id }));
  return (
    <HydrateClient>
      <MyConsultationView id={id} />
    </HydrateClient>
  );
}
