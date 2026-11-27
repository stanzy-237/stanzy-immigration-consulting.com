import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PublicPdfToolView } from '@/features/pdf-tools/views/public-pdf-tool-view';
import type { LocaleParams } from '@/i18n/routing';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PdfTools.public' });
  return shareMetadata({ locale, path: '/outils/pdf', card: 'pdf', title: t('metaTitle'), description: t('metaDescription') });
}

// Public: no account to build and download; compressing asks for one (see the view).
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PublicPdfToolView />;
}
