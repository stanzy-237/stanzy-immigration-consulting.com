import { ScrollText } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ServicePlaceholderView } from '@/features/service-placeholder/views/service-placeholder-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'Home.ServicesGrid.Items',
  });
  return { title: t('edeName') };
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ServicePlaceholderView nameKey="edeName" icon={ScrollText} />;
}
