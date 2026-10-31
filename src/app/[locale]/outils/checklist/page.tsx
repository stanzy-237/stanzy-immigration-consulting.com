import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ChecklistFormView } from '@/features/checklist/views/checklist-form-view';
import type { LocaleParams } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Checklist' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

// Public and static: a User's answers are fetched in the browser.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ChecklistFormView />;
}
