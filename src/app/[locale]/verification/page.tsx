import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  VerificationView,
  type VerificationSearchParams,
} from '@/features/auth/views/verification-view';
import type { LocaleParams } from '@/i18n/routing';

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
  searchParams: Promise<VerificationSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VerificationView searchParams={await searchParams} />;
}
