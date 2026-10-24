'use client';

import { useMemo } from 'react';

import { useCrsDraftValue } from '@/features/crs/hooks/use-crs-draft';
import { computeCrs } from '@/features/crs/lib/compute-crs';
import { rulesInForceOn } from '@/features/shared/lib/rules-version';
import { toProfile } from '@/features/crs/lib/crs-form';

/**
 * The visitor's latest CRS score on this device (from the calculator's saved
 * answers), or null before they have used it.
 */
export function useLatestCrsScore(): number | null {
  const draft = useCrsDraftValue();
  return useMemo(() => {
    if (!draft) return null;
    const result = computeCrs(toProfile(draft), { rules: rulesInForceOn(new Date()) });
    return result.ok ? result.breakdown.total : null;
  }, [draft]);
}
