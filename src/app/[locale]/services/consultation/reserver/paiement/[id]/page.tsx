import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PaymentReturnView } from '@/features/consultation/views/payment-return-view';
import type { Locale } from '@/i18n/routing';

// Per payment, read in the browser: nothing to prerender.
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: Locale; id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Consultation.reservation' });
  return { title: t('metaTitle'), robots: { index: false } };
}

/** Where SasPay's page sends the payer back (#15): how the payment went, then `6 Confirmée`. */
export default async function Page({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <PaymentReturnView paymentId={id} />;
}
