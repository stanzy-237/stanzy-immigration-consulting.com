import { getTranslations, setRequestLocale } from 'next-intl/server';

import { DrawPredictionView } from '@/features/draw-prediction/views/draw-prediction-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'DrawPrediction' });
  return { title: t('metaTitle') };
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DrawPredictionView />;
}
