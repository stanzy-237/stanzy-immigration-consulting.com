import { MeetingsHomeView } from '@/features/meetings/views/meetings-home-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.meetings.dashboard.today.queryOptions());
  return (
    <HydrateClient>
      <MeetingsHomeView />
    </HydrateClient>
  );
}
