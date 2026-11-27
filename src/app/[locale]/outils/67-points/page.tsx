import { getTranslations, setRequestLocale } from 'next-intl/server';

import { FswView } from '@/features/fsw/views/fsw-view';
import type { LocaleParams } from '@/i18n/routing';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'Home.ToolsGrid.Items',
  });
  return shareMetadata({ locale, path: '/outils/67-points', card: '67-points', title: t('fswName'), description: t('fswDesc') });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FswView />;
}
