import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AccompagnementView } from '@/features/accompagnement/views/accompagnement-view';
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
  return shareMetadata({ locale, path: '/services/accompagnement', card: 'accompagnement', title: t('accompagnementName'), description: t('accompagnementDesc') });
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AccompagnementView />;
}
