import type { EtapeColor } from './palette';

/** The icons a User can give an Étape (from the MagicPath design). */
export const ETAPE_EMOJIS = [
  '✈️', '🍁', '📄', '✅', '🏠', '💼', '🌍', '📋', '🔒', '💊',
  '🤳', '🛡️', '📬', '🎓', '🕒', '💰', '🎉', '⭐', '📅', '✏️',
  '🔎', '💬', '📞', '🇨🇦', '🚀', '🩺', '🧾', '🪪', '✉️', '🎯',
] as const;

export type EtapeEmoji = (typeof ETAPE_EMOJIS)[number];

export type EtapePreset = {
  code: string;
  /** Key under `Parcours.Presets` in the messages. */
  labelKey: string;
  emoji: EtapeEmoji;
  color: EtapeColor;
};

/** The preset catalogue, ITA to arrival (GLOSSARY: Étape). */
export const ETAPE_PRESETS: readonly EtapePreset[] = [
  { code: 'ITA', labelKey: 'ita', emoji: '✈️', color: 'stanzy-red' },
  { code: 'FRAIS', labelKey: 'frais', emoji: '💰', color: 'amber' },
  { code: 'DÉPÔT', labelKey: 'depot', emoji: '📄', color: 'blue' },
  { code: 'AOR', labelKey: 'aor', emoji: '✅', color: 'green' },
  { code: 'VM', labelKey: 'vm', emoji: '🩺', color: 'pink' },
  { code: 'MED', labelKey: 'med', emoji: '💊', color: 'green' },
  { code: 'IBIO', labelKey: 'ibio', emoji: '🤳', color: 'purple' },
  { code: 'BIO', labelKey: 'bio', emoji: '🛡️', color: 'green' },
  { code: 'SÉCU', labelKey: 'secu', emoji: '🔒', color: 'amber' },
  { code: 'ADR', labelKey: 'adr', emoji: '✏️', color: 'amber' },
  { code: 'PPR', labelKey: 'ppr', emoji: '📬', color: 'stanzy-red' },
  { code: 'COPR', labelKey: 'copr', emoji: '🍁', color: 'stanzy-red' },
  { code: 'ARRIVÉE', labelKey: 'arrivee', emoji: '🎉', color: 'green' },
  { code: 'AUTRE', labelKey: 'autre', emoji: '⭐', color: 'slate' },
];

/** Most Étapes one Account can hold. */
export const MAX_ETAPES = 100;
