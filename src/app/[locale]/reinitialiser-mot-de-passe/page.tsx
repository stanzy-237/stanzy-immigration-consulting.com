import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  ReinitialiserMotDePasseView,
  type ReinitialiserMotDePasseSearchParams,
} from '@/features/auth/views/reinitialiser-mot-de-passe-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.ReinitialiserMotDePasse' });
  // The URL carries a live reset token: keep it out of indexes and out of
  // the Referer sent to any other site.
  return { title: t('metaTitle'), robots: { index: false }, referrer: 'no-referrer' as const };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams: Promise<ReinitialiserMotDePasseSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ReinitialiserMotDePasseView searchParams={await searchParams} />;
}
