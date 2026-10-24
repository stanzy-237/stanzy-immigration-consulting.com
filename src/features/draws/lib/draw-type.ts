/**
 * IRCC publishes each Type de tirage in English, with a version suffix that
 * changes every year ("Trades Occupations, 2026-Version 3"). French pages show
 * a translated label instead: these rules map IRCC's name to a key under
 * `Draws.types` in the messages. Ordered: the first match wins. Unknown names
 * get no key and are shown as IRCC wrote them.
 */
const TYPE_RULES: ReadonlyArray<[RegExp, string]> = [
  [/^provincial nominee/i, 'pnp'],
  [/^canadian experience class/i, 'cec'],
  [/french/i, 'french'],
  [/^(no program specified|general)$/i, 'general'],
  [/^federal skilled worker/i, 'fsw'],
  [/^federal skilled trades/i, 'fst'],
  [/^physicians/i, 'physicians'],
  [/^senior managers/i, 'seniorManagers'],
  [/^skilled military/i, 'military'],
  [/^healthcare and social/i, 'healthSocial'],
  [/^healthcare/i, 'health'],
  [/^trades? occupations/i, 'trades'],
  [/^transport/i, 'transport'],
  [/^stem/i, 'stem'],
  [/^education/i, 'education'],
  [/^agriculture/i, 'agriculture'],
];

export function drawTypeKey(typeLabel: string): string | null {
  return TYPE_RULES.find(([pattern]) => pattern.test(typeLabel.trim()))?.[1] ?? null;
}
