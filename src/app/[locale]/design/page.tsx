import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { setRequestLocale } from 'next-intl/server';

import { isDesignShowcaseEnabled } from '@/features/design-showcase/lib/is-enabled';
import { DesignShowcaseView } from '@/features/design-showcase/views/design-showcase-view';
import type { LocaleParams } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Design System · Stanzy',
  robots: { index: false, follow: false },
};

export default async function DesignShowcasePage({
  params,
}: {
  params: LocaleParams;
}) {
  if (!isDesignShowcaseEnabled()) notFound();

  const { locale } = await params;
  setRequestLocale(locale);

  return <DesignShowcaseView />;
}
