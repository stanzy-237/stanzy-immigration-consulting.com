import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContactView } from '@/features/landing/views/contact-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.ContactPage' });
  return { title: t('metaTitle'), description: t('lead') };
}

export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactView />;
}
