import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DEFAULT_AVAILABILITY } from '@/features/consultation/lib/availability';
import { ConsultationView } from '@/features/consultation/views/consultation-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, publicTrpc } from '@/trpc/server';
import { shareMetadata } from '@/lib/share-metadata';

// Static with the free slots in its HTML, refreshed every 5 minutes; the
// booking step checks the chosen slot again before holding it.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.ServicesGrid.Items' });
  const copy = await getTranslations({ locale, namespace: 'Consultation.page' });
  return shareMetadata({
    locale,
    path: '/services/consultation',
    card: 'consultation',
    title: t('consultationName'),
    description: copy('metaDescription', { minutes: DEFAULT_AVAILABILITY.durationMinutes }),
  });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  prefetch(publicTrpc.consultation.slots.queryOptions());
  return (
    <HydrateClient>
      <ConsultationView />
    </HydrateClient>
  );
}
