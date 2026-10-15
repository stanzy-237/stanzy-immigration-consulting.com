import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import type { LocaleParams } from '@/i18n/routing';

import { LocaleSwitcher } from './locale-switcher';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  return { title: t('title') };
}

export default async function HomePage({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations('Home');
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-5xl font-bold text-rouge">{t('title')}</h1>
      <p className="text-2xl text-bleu">{t('tagline')}</p>
      <p className="text-lg text-bleu/70">{t('intro')}</p>
      <LocaleSwitcher label={t('localeLabel')} />
    </main>
  );
}
