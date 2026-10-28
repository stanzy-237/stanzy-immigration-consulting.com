import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BlogListView, type BlogListParams } from '@/features/blog/views/blog-list-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Blog' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams: Promise<BlogListParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BlogListView locale={locale} params={await searchParams} />;
}
