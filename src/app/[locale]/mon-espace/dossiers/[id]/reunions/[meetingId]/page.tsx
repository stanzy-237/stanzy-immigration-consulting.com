import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MeetingRoomView } from '@/features/meetings/views/meeting-room-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; id: string; meetingId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Meetings.panel' });
  return { title: t('title'), robots: { index: false } };
}

// Only the Client holding the Dossier gets in; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, id, meetingId } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/dossiers/${id}/reunions/${meetingId}` });
  prefetch(trpc.meetings.room.queryOptions({ id: meetingId }));
  return (
    <HydrateClient>
      <MeetingRoomView dossierId={id} meetingId={meetingId} viewer="client" />
    </HydrateClient>
  );
}
