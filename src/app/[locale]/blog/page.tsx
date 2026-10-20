import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BlogPlaceholderView } from '@/features/blog/views/blog-placeholder-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'BlogPlaceholder' });
  return { title: t('title') };
}

export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BlogPlaceholderView />;
}
