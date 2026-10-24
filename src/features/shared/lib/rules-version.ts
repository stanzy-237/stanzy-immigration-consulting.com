/**
 * The Express Entry rules a calculation follows, named after the day they
 * took effect: `2025-03-25` (CRS job-offer points removed) and `2026-11-03`
 * (CRS labour market integration factor; no LMIA needed for a qualifying
 * job offer). Both the Calculateur CRS and the Calculateur 67 points use it.
 */
export const RULES_2026_11_03_FROM = '2026-11-03';

export const RULES_VERSIONS = ['2025-03-25', '2026-11-03'] as const;
export type RulesVersion = (typeof RULES_VERSIONS)[number];

/** The rules IRCC applies on `date`, read as a calendar day in Ottawa. */
export function rulesInForceOn(date: Date): RulesVersion {
  const day = date.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  return day >= RULES_2026_11_03_FROM ? '2026-11-03' : '2025-03-25';
}
