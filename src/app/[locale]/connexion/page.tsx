import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ConnexionView } from '@/features/auth/views/connexion-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Connexion' });
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ConnexionView />;
}
