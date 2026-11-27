import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolPlaceholderView } from '@/features/tool-placeholder/views/tool-placeholder-view';
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
  return shareMetadata({ locale, path: '/outils/cnp', card: 'cnp', title: t('cnpName'), description: t('cnpDesc'), indexable: false });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ToolPlaceholderView slug="cnp" />;
}
