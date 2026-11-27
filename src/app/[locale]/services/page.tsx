import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ServicesView } from '@/features/landing/views/services-view';
import type { LocaleParams } from '@/i18n/routing';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.ServicesPage' });
  return shareMetadata({ locale, path: '/services', card: 'services', title: t('metaTitle'), description: t('subtitle') });
}

export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ServicesView />;
}
