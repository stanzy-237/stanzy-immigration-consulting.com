import { setRequestLocale } from 'next-intl/server';

import { InscriptionDialogView } from '@/features/auth/views/inscription-dialog-view';
import type { LocaleParams } from '@/i18n/routing';

// Intercepts in-app navigation to /inscription and shows it as a dialog over
// the current page. Direct visits and refreshes render ../../inscription/page.tsx.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InscriptionDialogView />;
}
