'use client';

import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { DossierContracts, DossierContractsSkeleton } from '@/features/contracts/components/dossier-contracts';

/**
 * A Dossier's Contrat and Avenants, for a Dossier page to show: the route
 * passes it to the dossiers view as its `contracts` slot, so neither feature
 * imports the other's UI.
 */
export function DossierContractsView({
  dossierId,
  viewer,
}: {
  dossierId: string;
  viewer: 'consultant' | 'client';
}): ReactNode {
  return (
    <QueryBoundary fallback={<DossierContractsSkeleton />}>
      <DossierContracts dossierId={dossierId} viewer={viewer} />
    </QueryBoundary>
  );
}
