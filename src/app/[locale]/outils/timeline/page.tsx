import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { ParcoursView } from '@/features/parcours/views/parcours-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'Home.ToolsGrid.Items',
  });
  return { title: t('timelineName') };
}

// A Parcours is private to its Account (ADR 0005: one guard call in the shell).
export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: '/outils/timeline' });
  return <ParcoursView />;
}
