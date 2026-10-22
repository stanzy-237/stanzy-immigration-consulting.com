import { setRequestLocale } from 'next-intl/server';

import type { NextParam } from '@/features/auth/lib/safe-next-path';
import { redirectIfSignedIn } from '@/features/auth/server/guards';
import { ConnexionDialogView } from '@/features/auth/views/connexion-dialog-view';
import type { LocaleParams } from '@/i18n/routing';

// Intercepts in-app navigation to /connexion and shows it as a dialog over the
// current page. Direct visits and refreshes render ../../connexion/page.tsx.
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
  return <ConnexionDialogView next={next} />;
}
