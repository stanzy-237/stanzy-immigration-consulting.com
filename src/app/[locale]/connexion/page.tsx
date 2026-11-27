import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ConnexionView } from '@/features/auth/views/connexion-view';
import type { LocaleParams } from '@/i18n/routing';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Connexion' });
  return shareMetadata({ locale, path: '/connexion', card: 'compte', title: t('metaTitle'), indexable: false });
}

// Static, so it opens instantly and Link can prefetch it. `?next=` and the
// "already signed in" case are handled in the browser by the view.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <ConnexionView />
    </Suspense>
  );
}
