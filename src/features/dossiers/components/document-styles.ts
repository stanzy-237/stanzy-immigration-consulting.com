import type { RouterOutputs } from '@/trpc/types';

/** Who is looking at a Dossier's documents: the consultant gets the extra controls. */
export type Viewer = 'consultant' | 'client';

export type DocumentData = RouterOutputs['dossiers']['documents']['sections']['sections'][number]['documents'][number];

export const fieldClass =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';

export const smallButton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-50';
