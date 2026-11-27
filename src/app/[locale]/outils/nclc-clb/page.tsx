import { getTranslations, setRequestLocale } from 'next-intl/server';

import { NclcView } from '@/features/nclc/views/nclc-view';
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
  return shareMetadata({ locale, path: '/outils/nclc-clb', card: 'nclc-clb', title: t('nclcName'), description: t('nclcDesc') });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NclcView />;
}
