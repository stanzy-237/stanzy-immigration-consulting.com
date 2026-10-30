import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ToolsView } from '@/features/landing/views/tools-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.ToolsGrid' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ToolsView />;
}
