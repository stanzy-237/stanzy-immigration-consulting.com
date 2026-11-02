import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MySpaceView } from '@/features/dossiers/views/my-space-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dossiers.mySpace' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// A Client's Dossiers are private to their Account (ADR 0005: one guard call in the shell).
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: '/mon-espace' });
  prefetch(trpc.dossiers.mine.queryOptions());
  return (
    <HydrateClient>
      <MySpaceView />
    </HydrateClient>
  );
}
