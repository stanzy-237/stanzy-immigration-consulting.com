/** The stream a Tirage targeted, as the filter chips group them. */
export const DRAW_GROUPS = ['GENERAL', 'PNP', 'CEC', 'FRENCH', 'CATEGORY'] as const;
export type DrawGroup = (typeof DRAW_GROUPS)[number];

/**
 * IRCC publishes each Type de tirage in English, with a version suffix that
 * changes every year ("Trades Occupations, 2026-Version 3"). One ordered table
 * (first match wins) gives each name its group and the key of its French label
 * under `Draws.types`. Unknown names fall into CATEGORY, with no French label,
 * and are shown as IRCC wrote them.
 *
 * Federal Skilled Worker and Federal Skilled Trades are program rounds like
 * CEC, not category-based selection, so they sit with the general rounds.
 */
const TYPE_RULES: ReadonlyArray<[RegExp, string, DrawGroup]> = [
  [/^provincial nominee/i, 'pnp', 'PNP'],
  [/^canadian experience class/i, 'cec', 'CEC'],
  [/french/i, 'french', 'FRENCH'],
  [/^(no program specified|general)$/i, 'general', 'GENERAL'],
  [/^federal skilled worker/i, 'fsw', 'GENERAL'],
  [/^federal skilled trades/i, 'fst', 'GENERAL'],
  [/^physicians/i, 'physicians', 'CATEGORY'],
  [/^senior managers/i, 'seniorManagers', 'CATEGORY'],
  [/^skilled military/i, 'military', 'CATEGORY'],
  [/^healthcare and social/i, 'healthSocial', 'CATEGORY'],
  [/^healthcare/i, 'health', 'CATEGORY'],
  [/^trades? occupations/i, 'trades', 'CATEGORY'],
  [/^transport/i, 'transport', 'CATEGORY'],
  [/^stem/i, 'stem', 'CATEGORY'],
  [/^education/i, 'education', 'CATEGORY'],
  [/^agriculture/i, 'agriculture', 'CATEGORY'],
];

const ruleFor = (typeLabel: string) => TYPE_RULES.find(([pattern]) => pattern.test(typeLabel.trim()));

export function drawTypeKey(typeLabel: string): string | null {
  return ruleFor(typeLabel)?.[1] ?? null;
}

export function groupFor(typeLabel: string): DrawGroup {
  return ruleFor(typeLabel)?.[2] ?? 'CATEGORY';
}
