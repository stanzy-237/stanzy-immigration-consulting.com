import { DashboardLoadingView } from '@/features/dashboard/views/dashboard-loading-view';

// A Réunion's room is not one of the tabs.
export default function Loading() {
  return <DashboardLoadingView variant="detail" />;
}
