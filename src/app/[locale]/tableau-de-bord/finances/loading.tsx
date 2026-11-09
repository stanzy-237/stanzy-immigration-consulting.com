import { FinancesLoadingView } from '@/features/finances/views/finances-loading-view';

// Each Finances tab has its own: the tabs move at once, only the rows wait.
export default function Loading() {
  return <FinancesLoadingView page="overview" />;
}
