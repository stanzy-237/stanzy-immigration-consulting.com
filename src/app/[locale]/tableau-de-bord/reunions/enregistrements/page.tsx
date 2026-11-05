import { MeetingRecordingsView } from '@/features/meetings/views/meeting-recordings-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.meetings.dashboard.recordings.queryOptions());
  return (
    <HydrateClient>
      <MeetingRecordingsView />
    </HydrateClient>
  );
}
