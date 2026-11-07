import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PublicPdfToolView } from '@/features/pdf-tools/views/public-pdf-tool-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PdfTools.public' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

// Public: no account to build and download; compressing asks for one (see the view).
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PublicPdfToolView />;
}
