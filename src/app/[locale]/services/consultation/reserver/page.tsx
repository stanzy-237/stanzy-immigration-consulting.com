import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ReservationView } from '@/features/consultation/views/reservation-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, publicTrpc } from '@/trpc/server';

// Static: the free slots (for the summary and « Créneau libéré ») refresh every
// 5 minutes; the booking itself is read in the browser, per visitor.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Consultation.reservation' });
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  prefetch(publicTrpc.consultation.slots.queryOptions());
  return (
    <HydrateClient>
      <ReservationView />
    </HydrateClient>
  );
}
