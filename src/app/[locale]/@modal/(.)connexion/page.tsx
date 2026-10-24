import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';

import { ConnexionDialogView } from '@/features/auth/views/connexion-dialog-view';
import type { LocaleParams } from '@/i18n/routing';

// Intercepts in-app navigation to /connexion and shows it as a dialog over the
// current page. Direct visits and refreshes render ../../connexion/page.tsx.
// Static, so it opens instantly and Link can prefetch it. `?next=` and the
// "already signed in" case are handled in the browser by the view.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <ConnexionDialogView />
    </Suspense>
  );
}
