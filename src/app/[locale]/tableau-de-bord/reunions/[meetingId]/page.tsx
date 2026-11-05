import { MeetingRoomView } from '@/features/meetings/views/meeting-room-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  prefetch(trpc.meetings.room.queryOptions({ id: meetingId }));
  return (
    <HydrateClient>
      <MeetingRoomView meetingId={meetingId} viewer="consultant" />
    </HydrateClient>
  );
}
