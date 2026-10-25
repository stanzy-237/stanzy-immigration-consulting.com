import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ItaCountdownView } from '@/features/ita-countdown/views/ita-countdown-view';
import type { LocaleParams } from '@/i18n/routing';

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
  return { title: t('itaName') };
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ItaCountdownView />;
}
