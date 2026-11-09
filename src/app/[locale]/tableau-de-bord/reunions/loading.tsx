import { MeetingsLoadingView } from '@/features/meetings/views/meetings-loading-view';

// Each Réunions tab has its own: the tabs move at once, only the cards wait.
export default function Loading() {
  return <MeetingsLoadingView page="home" />;
}
