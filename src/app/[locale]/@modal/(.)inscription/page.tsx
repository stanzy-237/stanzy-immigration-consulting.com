import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';

import { InscriptionDialogView } from '@/features/auth/views/inscription-dialog-view';
import type { LocaleParams } from '@/i18n/routing';

// Intercepts in-app navigation to /inscription and shows it as a dialog over
// the current page. Direct visits and refreshes render ../../inscription/page.tsx.
// Static, so it opens instantly and Link can prefetch it. `?next=` and the
// "already signed in" case are handled in the browser by the view.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <InscriptionDialogView />
    </Suspense>
  );
}
