import { PageSkeleton } from '@/components/page-skeleton';

// Shown at once on a click to any Tableau de bord page; the sidebar stays.
export default function Loading() {
  return <PageSkeleton />;
}
