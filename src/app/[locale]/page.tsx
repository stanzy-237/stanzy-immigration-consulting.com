import { getTranslations, setRequestLocale } from 'next-intl/server';

import { HomeView } from '@/features/landing/views/home-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  return { title: t('title') };
}

export default async function HomePage({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeView />;
}
