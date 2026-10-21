import { setRequestLocale } from 'next-intl/server';

import { ConnexionDialogView } from '@/features/auth/views/connexion-dialog-view';
import type { LocaleParams } from '@/i18n/routing';

// Intercepts in-app navigation to /connexion and shows it as a dialog over the
// current page. Direct visits and refreshes render ../../connexion/page.tsx.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ConnexionDialogView />;
}
