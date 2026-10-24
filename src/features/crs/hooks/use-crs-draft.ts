'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import { crsFormSchema, DEFAULT_FORM, type CrsForm } from '@/features/crs/lib/crs-form';

/** Versioned, so a later change to the form shape discards old drafts instead of breaking. */
export const CRS_DRAFT_KEY = 'stanzy.crs.draft.v1';

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CRS_DRAFT_KEY);
  } catch {
    return null;
  }
}

function parseDraft(raw: string | null): CrsForm | null {
  if (!raw) return null;
  try {
    const parsed = crsFormSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The draft saved in this browser, or null (no draft, or storage unavailable). */
export function readDraft(): CrsForm | null {
  return parseDraft(readRaw());
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * The saved draft as a React value: null on the server and during hydration,
 * so the static page renders the same on both, then the browser's copy.
 */
export function useStoredDraft(): CrsForm | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parseDraft(raw), [raw]);
}

/**
 * The calculator's answers, kept in this browser between visits (and across
 * the sign-in round-trip). Storage can be unavailable (private mode); the
 * calculator then simply starts fresh each time.
 */
export function useCrsDraft(): [CrsForm, (next: CrsForm) => void] {
  const stored = useStoredDraft();
  const [edited, setEdited] = useState<CrsForm | null>(null);

  const update = useCallback((next: CrsForm) => {
    setEdited(next);
    try {
      window.localStorage.setItem(CRS_DRAFT_KEY, JSON.stringify(next));
    } catch {
      // Storage full or blocked: the answers still work for this visit.
    }
  }, []);

  return [edited ?? stored ?? DEFAULT_FORM, update];
}
