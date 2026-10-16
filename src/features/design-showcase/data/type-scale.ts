export type TypeRow = {
  label: string;
  token: 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'body-lg' | 'body';
  lineHeight: number;
  weight: number;
  family: string;
};

export const TYPE_SCALE: readonly TypeRow[] = [
  { label: 'Display · Syne 72', token: 'display', lineHeight: 1, weight: 700, family: 'font-heading' },
  { label: 'H1 · Syne 56', token: 'h1', lineHeight: 1.1, weight: 700, family: 'font-heading' },
  { label: 'H2 · Syne 40', token: 'h2', lineHeight: 1.15, weight: 700, family: 'font-heading' },
  { label: 'H3 · Syne 28', token: 'h3', lineHeight: 1.2, weight: 700, family: 'font-heading' },
  { label: 'H4 · Work Sans 20 Semibold', token: 'h4', lineHeight: 1.3, weight: 600, family: 'font-body' },
  { label: 'Body LG — Work Sans 18', token: 'body-lg', lineHeight: 1.75, weight: 400, family: 'font-body text-text-muted' },
  { label: 'Body — Work Sans 16', token: 'body', lineHeight: 1.75, weight: 400, family: 'font-body text-text-muted' },
];
