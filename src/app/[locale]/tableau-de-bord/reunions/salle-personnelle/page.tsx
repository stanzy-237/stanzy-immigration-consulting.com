import { PersonalRoomView } from '@/features/meetings/views/personal-room-view';
import { HydrateClient } from '@/trpc/server';

// Not prefetched: the first visit makes the room, which a prefetch (a GET) shouldn't.
export default function Page() {
  return (
    <HydrateClient>
      <PersonalRoomView />
    </HydrateClient>
  );
}
