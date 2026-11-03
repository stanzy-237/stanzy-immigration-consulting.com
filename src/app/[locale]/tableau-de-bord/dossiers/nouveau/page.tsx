import { DossierNewView } from '@/features/dossiers/views/dossier-new-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

// `?account=<id>` from an Account's page in « Comptes »: that Account is already chosen.
export default async function Page({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  if (account) prefetch(trpc.accounts.dashboard.get.queryOptions({ id: account }));
  return (
    <HydrateClient>
      <DossierNewView accountId={account} />
    </HydrateClient>
  );
}
