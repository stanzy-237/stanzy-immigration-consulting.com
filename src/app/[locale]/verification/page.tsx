import { getTranslations, setRequestLocale } from 'next-intl/server';

import { VerificationView } from '@/features/auth/views/verification-view';
import type { LocaleParams } from '@/i18n/routing';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Verification' });
  return { title: t('metaTitle'), robots: { index: false } };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  return (
    <VerificationView
      email={first(query.email)}
      status={first(query.status)}
      error={first(query.error)}
    />
  );
}
