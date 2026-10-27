import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BudgetView } from '@/features/budget/views/budget-view';
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
  return { title: t('budgetName') };
}

// Public and static, unlike the Parcours: the estimator needs no Account. Only
// the « Mes dépenses » tab does, and it shows its own sign-in invite; its data
// is guarded by the budget router's protected procedures.
export default async function Page({
  params,
}: {
  params: LocaleParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BudgetView />;
}
