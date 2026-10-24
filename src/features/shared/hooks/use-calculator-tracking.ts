'use client';

import { useCallback, useEffect, useRef } from 'react';

import { track } from '@/lib/analytics';

/**
 * A calculator's analytics: `<prefix>.viewed` once per visit, and the returned
 * `markStarted` sends `<prefix>.started` on the first answer. No answers are
 * ever sent.
 */
export function useCalculatorTracking(prefix: string): () => void {
  const started = useRef(false);
  useEffect(() => track(`${prefix}.viewed`), [prefix]);
  return useCallback(() => {
    if (started.current) return;
    started.current = true;
    track(`${prefix}.started`);
  }, [prefix]);
}
