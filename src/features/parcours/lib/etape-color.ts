import {
  ETAPE_COLOR_CLASSES,
  ETAPE_COLORS,
  type EtapeColor,
  type EtapeColorClasses,
} from '@/features/parcours/data/palette';

const isEtapeColor = (key: string): key is EtapeColor => (ETAPE_COLORS as readonly string[]).includes(key);

/** The Tailwind classes of a stored palette key; unknown keys read as slate. */
export function colorClasses(key: string): EtapeColorClasses {
  return ETAPE_COLOR_CLASSES[isEtapeColor(key) ? key : 'slate'];
}
