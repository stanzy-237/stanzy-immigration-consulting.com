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
  const nav = await getTranslations({ locale, namespace: 'Home.Nav.Tools' });
  return shareMetadata({ locale, path: '/outils/coffre-fort', card: 'coffre-fort', title: t('cloudsName'), description: nav('cloudsDesc') });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ToolPlaceholderView slug="clouds" />;
}
