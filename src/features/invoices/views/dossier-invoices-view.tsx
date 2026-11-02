'use client';

import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { DossierInvoices, DossierInvoicesSkeleton } from '@/features/invoices/components/dossier-invoices';

/**
 * A Dossier's Factures, for a Dossier page to show: the route passes it to
 * the dossiers view as its `invoices` slot, so neither feature imports the other's UI.
 */
export function DossierInvoicesView({
  dossierId,
  viewer,
}: {
  dossierId: string;
  viewer: 'consultant' | 'client';
}): ReactNode {
  return (
    <QueryBoundary fallback={<DossierInvoicesSkeleton />}>
      <DossierInvoices dossierId={dossierId} viewer={viewer} />
    </QueryBoundary>
  );
}
