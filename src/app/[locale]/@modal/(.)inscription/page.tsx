import { setRequestLocale } from 'next-intl/server';

import type { NextParam } from '@/features/auth/lib/safe-next-path';
import { redirectIfSignedIn } from '@/features/auth/server/guards';
import { InscriptionDialogView } from '@/features/auth/views/inscription-dialog-view';
import type { LocaleParams } from '@/i18n/routing';

// Intercepts in-app navigation to /inscription and shows it as a dialog over
// the current page. Direct visits and refreshes render ../../inscription/page.tsx.
export default async function Page({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams: Promise<{ next?: NextParam }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  await redirectIfSignedIn({ locale, next });
  return <InscriptionDialogView next={next} />;
}
