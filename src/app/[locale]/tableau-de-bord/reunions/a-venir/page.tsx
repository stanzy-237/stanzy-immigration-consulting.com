import { MeetingsListView } from '@/features/meetings/views/meetings-list-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.meetings.dashboard.list.queryOptions({ list: 'upcoming' }));
  return (
    <HydrateClient>
      <MeetingsListView list="upcoming" />
    </HydrateClient>
  );
}
