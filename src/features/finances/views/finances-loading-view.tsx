'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { FinanceListSkeleton } from '@/features/finances/components/finance-fields';
import { FinancesHeader, type FinancePage } from '@/features/finances/components/finances-header';
import { financeYear } from '@/features/finances/lib/finance-year';

/**
 * A Finances tab while it loads: its header and tabs drawn at once, on the
 * year asked for (`?annee=`), and the rows to come below.
 */
export function FinancesLoadingView({ page }: { page: FinancePage }): ReactNode {
  const year = financeYear(useSearchParams().get('annee') ?? undefined);
  return (
    <div className="mx-auto grid grid-cols-1 max-w-5xl gap-6">
      <FinancesHeader page={page} year={year} />
      <div className="animate-skeleton-in">
        <FinanceListSkeleton />
      </div>
    </div>
  );
}
