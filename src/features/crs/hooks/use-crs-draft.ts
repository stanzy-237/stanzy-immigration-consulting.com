'use client';

import { crsFormSchema, DEFAULT_FORM, type CrsForm } from '@/features/crs/lib/crs-form';
import { readStored, useStoredForm, useStoredValue } from '@/features/shared/hooks/use-stored-form';

/** Versioned, so a later change to the form shape discards old drafts instead of breaking. */
export const CRS_DRAFT_KEY = 'stanzy.crs.draft.v1';

/** The CRS draft saved in this browser, or null. */
export const readDraft = (): CrsForm | null => readStored(CRS_DRAFT_KEY, crsFormSchema);

/** The CRS draft as a React value (null on the server and during hydration). */
export const useStoredDraft = (): CrsForm | null => useStoredValue(CRS_DRAFT_KEY, crsFormSchema);

/**
 * The CRS calculator's answers, kept in this browser between visits (and
 * across the sign-in round-trip).
 */
export const useCrsDraft = (): [CrsForm, (next: CrsForm) => void] =>
  useStoredForm(CRS_DRAFT_KEY, crsFormSchema, DEFAULT_FORM);
