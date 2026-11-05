import { MeetingsListView } from '@/features/meetings/views/meetings-list-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.meetings.dashboard.list.queryOptions({ list: 'past' }));
  return (
    <HydrateClient>
      <MeetingsListView list="past" />
    </HydrateClient>
  );
}
