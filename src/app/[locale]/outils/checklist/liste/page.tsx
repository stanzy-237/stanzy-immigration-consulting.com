import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ChecklistView } from '@/features/checklist/views/checklist-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Checklist' });
  return { title: t('listMetaTitle'), robots: { index: false } };
}

// Public and static: the list is built in the browser from the answers kept
// there or in the Account.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ChecklistView />;
}
