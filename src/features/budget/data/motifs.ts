/**
 * Why a Dépense was paid. Keys are stored; labels live in the `Budget.motifs`
 * messages. « Autre » stays last.
 */
export const MOTIFS = [
  'languageTest',
  'eca',
  'irccFees',
  'rprf',
  'biometrics',
  'medical',
  'police',
  'translations',
  'passport',
  'courier',
  'flight',
  'consultant',
  'other',
] as const;

export type Motif = (typeof MOTIFS)[number];

/** The most Dépenses one Account can log. */
export const BUDGET_LIMIT = 500;
