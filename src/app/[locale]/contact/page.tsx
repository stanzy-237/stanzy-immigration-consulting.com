import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContactView } from '@/features/landing/views/contact-view';
import type { LocaleParams } from '@/i18n/routing';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.ContactPage' });
  return shareMetadata({ locale, path: '/contact', card: 'accueil', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactView />;
}
