/** A bar in a topic's preview: its message key, how full it is (0–100) and its colour class. */
export type PreviewRow = { key: string; percent: number; bar: string };

export type Topic = { key: string; rows: PreviewRow[] };

/**
 * « Ce qu'on aborde »: the four topics of a Consultation, each with a preview
 * drawn from a sample profile (`Consultation.page.topics.<key>`).
 */
export const TOPICS: Topic[] = [
  {
    key: 'eligibility',
    rows: [
      { key: 'fsw', percent: 78, bar: 'bg-rouge' },
      { key: 'cec', percent: 24, bar: 'bg-rose' },
      { key: 'pnp', percent: 56, bar: 'bg-steel-blue' },
    ],
  },
  {
    key: 'points',
    rows: [
      { key: 'english', percent: 82, bar: 'bg-rouge' },
      { key: 'french', percent: 50, bar: 'bg-rose' },
      { key: 'studies', percent: 30, bar: 'bg-steel-blue' },
    ],
  },
  {
    key: 'documents',
    rows: [
      { key: 'test', percent: 100, bar: 'bg-rouge' },
      { key: 'ede', percent: 60, bar: 'bg-rose' },
      { key: 'funds', percent: 35, bar: 'bg-steel-blue' },
    ],
  },
  {
    key: 'next',
    rows: [
      { key: 'tools', percent: 100, bar: 'bg-rouge' },
      { key: 'accompagnement', percent: 70, bar: 'bg-rose' },
      { key: 'pool', percent: 40, bar: 'bg-steel-blue' },
    ],
  },
];
