import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { InscriptionView } from '@/features/auth/views/inscription-view';
import type { LocaleParams } from '@/i18n/routing';
import { shareMetadata } from '@/lib/share-metadata';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.Inscription' });
  return shareMetadata({ locale, path: '/inscription', card: 'compte', title: t('metaTitle'), indexable: false });
}

// Static, so it opens instantly and Link can prefetch it. `?next=` and the
// "already signed in" case are handled in the browser by the view.
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <InscriptionView />
    </Suspense>
  );
}
