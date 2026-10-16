export type HeroStat = {
  key: 'tools' | 'supported' | 'success';
  value: string;
  labelKey: string;
};

// Three proof tiles from the MagicPath hero: 5+ outils, 120+ accompagnés,
// 80% réussite (US #5).
export const HERO_STATS: ReadonlyArray<HeroStat> = [
  { key: 'tools', value: '5+', labelKey: 'tools' },
  { key: 'supported', value: '120+', labelKey: 'supported' },
  { key: 'success', value: '80%', labelKey: 'success' },
] as const;
