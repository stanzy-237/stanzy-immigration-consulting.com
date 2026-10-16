export type HeroStat = {
  key: 'tools' | 'supported' | 'success';
  value: string;
  labelKey: string;
  highlight?: boolean;
};

// Three proof tiles from the MagicPath hero: 5+ outils, 120+ accompagnés,
// 80% réussite (US #5). The success tile uses the rouge accent colour
// (`.sn-stat-num.red` in the design).
export const HERO_STATS: ReadonlyArray<HeroStat> = [
  { key: 'tools', value: '5+', labelKey: 'tools' },
  { key: 'supported', value: '120+', labelKey: 'supported' },
  { key: 'success', value: '80%', labelKey: 'success', highlight: true },
] as const;
