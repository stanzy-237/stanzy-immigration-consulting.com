import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/features/i18n/components/locale-switcher';

export function HomeView() {
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
