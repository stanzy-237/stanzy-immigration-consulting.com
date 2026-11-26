import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MyConsultationsView } from '@/features/consultation/views/my-consultations-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Consultation.space' });
  return { title: t('listTitle'), robots: { index: false } };
}

// Only the signed-in Account's Consultations (ADR 0005).
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: '/mon-espace/consultations' });
  prefetch(trpc.consultationSpace.list.queryOptions());
  return (
    <HydrateClient>
      <MyConsultationsView />
    </HydrateClient>
  );
}
