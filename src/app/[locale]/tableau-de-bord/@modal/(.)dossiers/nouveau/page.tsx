import { DossierNewDialogView } from '@/features/dossiers/views/dossier-new-dialog-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

// Intercepts in-app navigation to /dossiers/nouveau and opens « Ouvrir un dossier » as a dialog
// over the current page. Direct visits and refreshes render ../../../dossiers/nouveau/page.tsx.
export default async function Page({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  if (account) prefetch(trpc.accounts.dashboard.get.queryOptions({ id: account }));
  return (
    <HydrateClient>
      <DossierNewDialogView accountId={account} />
    </HydrateClient>
  );
}
