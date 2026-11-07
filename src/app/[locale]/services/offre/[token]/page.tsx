import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { OfferView } from '@/features/document-services/views/offer-view';
import { getCurrentSession } from '@/server/auth/session';
import { getQueryClient, HydrateClient, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'DocumentServices.offer' });
  // A private link: never indexed.
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

// Open to anyone with the link; the order needs a session (the procedures decide, ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const session = await getCurrentSession(await headers());
  try {
    await getQueryClient().fetchQuery(trpc.documentServices.orders.offer.queryOptions({ token }));
  } catch {
    notFound();
  }
  return (
    <HydrateClient>
      <OfferView token={token} signedIn={session !== null} />
    </HydrateClient>
  );
}
