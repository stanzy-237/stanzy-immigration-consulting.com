import { z } from 'zod';

import { SERVICE_TYPES } from '@/features/dossiers/data/workflows';

export const DOSSIER_FILTERS = ['OPEN', 'CLOSED', 'ALL'] as const;
export type DossierFilter = (typeof DOSSIER_FILTERS)[number];

export const dossierListInput = z.object({ state: z.enum(DOSSIER_FILTERS) });

export const accountSearchInput = z.object({ query: z.string().trim().min(2).max(100) });

export const openDossierInput = z.object({
  accountId: z.string().min(1),
  service: z.enum(SERVICE_TYPES),
  /** Checked against the service's stages on the server. */
  startStage: z.string().min(1),
});

/** `from` is the stage the consultant saw: a move from a stale page is refused. */
export const moveDossierInput = z.object({ id: z.string().min(1), from: z.string().min(1) });

export const CLOSE_REASON_MAX = 500;
export const closeDossierInput = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(3).max(CLOSE_REASON_MAX),
});
