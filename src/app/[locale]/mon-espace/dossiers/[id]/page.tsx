import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MyDossierView } from '@/features/dossiers/views/my-dossier-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dossiers.mySpace' });
  return { title: t('metaTitleDossier'), robots: { index: false } };
}

// Only its own Client reaches a Dossier here; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/dossiers/${id}` });
  prefetch(trpc.dossiers.myDossier.queryOptions({ id }));
  prefetch(trpc.dossiers.documents.sections.queryOptions({ dossierId: id }));
  return (
    <HydrateClient>
      <MyDossierView id={id} />
    </HydrateClient>
  );
}
