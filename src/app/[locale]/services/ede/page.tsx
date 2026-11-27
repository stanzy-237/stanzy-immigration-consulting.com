import { ScrollText } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ServicePlaceholderView } from '@/features/service-placeholder/views/service-placeholder-view';
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
    namespace: 'Home.ServicesGrid.Items',
  });
  return shareMetadata({ locale, path: '/services/ede', card: 'ede', title: t('edeName'), description: t('edeDesc'), indexable: false });
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
