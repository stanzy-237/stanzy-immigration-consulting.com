import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CompteView } from '@/features/auth/views/compte-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Compte' });
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CompteView />;
}
