import { getTranslations, setRequestLocale } from 'next-intl/server';

import { InterestView } from '@/features/accompagnement/views/interest-view';
import { requireSession } from '@/features/auth/server/guards';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Accompagnement.form' });
  return { title: t('title'), robots: { index: false } };
}

// Signed in only: the Demande d'intérêt belongs to an Account (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: '/mon-espace/accompagnement' });
  prefetch(trpc.accompagnement.mine.queryOptions());
  prefetch(trpc.checklist.get.queryOptions());
  prefetch(trpc.crs.list.queryOptions());
  return (
    <HydrateClient>
      <InterestView />
    </HydrateClient>
  );
}
