/**
 * The colours a User can give an Étape. The database stores the key; each key
 * maps to static Tailwind classes so a card never needs a runtime hex.
 */
export const ETAPE_COLORS = [
  'stanzy-red',
  'stanzy-blue',
  'green',
  'amber',
  'blue',
  'pink',
  'purple',
  'slate',
  'teal',
  'orange',
] as const;

export type EtapeColor = (typeof ETAPE_COLORS)[number];

export type EtapeColorClasses = {
  /** Solid fill: swatches, the form's days line marker. */
  solid: string;
  /** Translucent fill behind the emoji and the code pill. */
  tint: string;
  /** Text in the Étape colour: the code pill. */
  text: string;
  /** Border in the Étape colour: the share view's dots and the days line. */
  border: string;
  /** The share view's connecting line, fading to fog. */
  line: string;
  /** Selection ring of a swatch. */
  ring: string;
};

export const ETAPE_COLOR_CLASSES: Record<EtapeColor, EtapeColorClasses> = {
  'stanzy-red': {
    solid: 'bg-rouge',
    tint: 'bg-rouge/15',
    text: 'text-rouge',
    border: 'border-rouge',
    line: 'from-rouge',
    ring: 'ring-rouge',
  },
  'stanzy-blue': {
    solid: 'bg-navy-deep',
    tint: 'bg-navy-deep/15',
    text: 'text-navy-deep',
    border: 'border-navy-deep',
    line: 'from-navy-deep',
    ring: 'ring-navy-deep',
  },
  green: {
    solid: 'bg-etape-green',
    tint: 'bg-etape-green/15',
    text: 'text-etape-green',
    border: 'border-etape-green',
    line: 'from-etape-green',
    ring: 'ring-etape-green',
  },
  amber: {
    solid: 'bg-etape-amber',
    tint: 'bg-etape-amber/15',
    text: 'text-etape-amber',
    border: 'border-etape-amber',
    line: 'from-etape-amber',
    ring: 'ring-etape-amber',
  },
  blue: {
    solid: 'bg-etape-blue',
    tint: 'bg-etape-blue/15',
    text: 'text-etape-blue',
    border: 'border-etape-blue',
    line: 'from-etape-blue',
    ring: 'ring-etape-blue',
  },
  pink: {
    solid: 'bg-etape-pink',
    tint: 'bg-etape-pink/15',
    text: 'text-etape-pink',
    border: 'border-etape-pink',
    line: 'from-etape-pink',
    ring: 'ring-etape-pink',
  },
  purple: {
    solid: 'bg-etape-purple',
    tint: 'bg-etape-purple/15',
    text: 'text-etape-purple',
    border: 'border-etape-purple',
    line: 'from-etape-purple',
    ring: 'ring-etape-purple',
  },
  slate: {
    solid: 'bg-steel-blue',
    tint: 'bg-steel-blue/15',
    text: 'text-steel-blue',
    border: 'border-steel-blue',
    line: 'from-steel-blue',
    ring: 'ring-steel-blue',
  },
  teal: {
    solid: 'bg-etape-teal',
    tint: 'bg-etape-teal/15',
    text: 'text-etape-teal',
    border: 'border-etape-teal',
    line: 'from-etape-teal',
    ring: 'ring-etape-teal',
  },
  orange: {
    solid: 'bg-etape-orange',
    tint: 'bg-etape-orange/15',
    text: 'text-etape-orange',
    border: 'border-etape-orange',
    line: 'from-etape-orange',
    ring: 'ring-etape-orange',
  },
};
