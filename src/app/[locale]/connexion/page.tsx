import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { NextParam } from '@/features/auth/lib/safe-next-path';
import { redirectIfSignedIn } from '@/features/auth/server/guards';
import { ConnexionView } from '@/features/auth/views/connexion-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Connexion' });
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams: Promise<{ next?: NextParam }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  // Signed in already: go on to `next` instead of showing the form.
  await redirectIfSignedIn({ locale, next });
  return <ConnexionView next={next} />;
}
