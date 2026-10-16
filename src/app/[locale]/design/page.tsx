import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { setRequestLocale } from 'next-intl/server';

import { DesignShowcaseView } from '@/features/design-showcase/views/design-showcase-view';
import type { LocaleParams } from '@/i18n/routing';

const SHOWCASE_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_DESIGN_SHOWCASE === '1';

export const metadata: Metadata = {
  title: 'Design System · Stanzy',
  robots: { index: false, follow: false },
};

export default async function DesignShowcasePage({
  params,
}: {
  params: LocaleParams;
}) {
  if (!SHOWCASE_ENABLED) notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  return <DesignShowcaseView />;
}
