/**
 * The blocks of an « En savoir plus » guide (the budget's fees, the
 * Checklist's documents). Content, not code: a guide is a list of blocks, so
 * the consultant can later edit them from the Tableau de bord.
 */
export type GuideBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; title?: string; items: string[] }
  /** Highlighted, e.g. a warning or Stanzy's own offer. */
  | { kind: 'note'; text: string }
  /** `href` starting with « / » is a page of this site, in the visitor's language. */
  | { kind: 'link'; label: string; href: string }
  /** A button, e.g. « Me contacter sur WhatsApp » (tone `whatsapp`) or a Stanzy service. */
  | { kind: 'cta'; label: string; href: string; tone?: 'whatsapp' }
  /** Two columns; the first cell of each row heads it (e.g. an age bracket). */
  | { kind: 'table'; caption: string; head?: [string, string]; rows: [string, string][] };
