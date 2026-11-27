import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CrsView } from '@/features/crs/views/crs-view';
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
  return shareMetadata({ locale, path: '/outils/crs', card: 'crs', title: t('crsName'), description: t('crsDesc') });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CrsView />;
}
