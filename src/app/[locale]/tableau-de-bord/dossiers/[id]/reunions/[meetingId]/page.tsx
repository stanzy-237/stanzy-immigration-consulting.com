import { MeetingRoomView } from '@/features/meetings/views/meeting-room-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string; meetingId: string }> }) {
  const { id, meetingId } = await params;
  prefetch(trpc.meetings.room.queryOptions({ id: meetingId }));
  return (
    <HydrateClient>
      <MeetingRoomView dossierId={id} meetingId={meetingId} viewer="consultant" />
    </HydrateClient>
  );
}
