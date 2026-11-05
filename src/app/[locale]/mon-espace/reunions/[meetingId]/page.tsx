import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { MeetingRoomView } from '@/features/meetings/views/meeting-room-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; meetingId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Meetings.panel' });
  return { title: t('title'), robots: { index: false } };
}

// Only those invited get in; the procedures answer NOT_FOUND to anyone else (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, meetingId } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/mon-espace/reunions/${meetingId}` });
  prefetch(trpc.meetings.room.queryOptions({ id: meetingId }));
  return (
    <HydrateClient>
      <MeetingRoomView meetingId={meetingId} viewer="client" />
    </HydrateClient>
  );
}
