export type DrawCategoryColor = 'red' | 'blue' | 'green' | 'amber';

export type Draw = {
  round: number;
  date: string;
  categoryKey: string;
  categoryColor: DrawCategoryColor;
  crsMin: number;
  invitations: number;
  featured?: boolean;
};

// Four static placeholder draws from the MagicPath design. Live data pipeline
// is a follow-up (per issue #12 "Out of Scope").
export const DRAWS: ReadonlyArray<Draw> = [
  {
    round: 345,
    date: '9 oct. 2024',
    categoryKey: 'catAll',
    categoryColor: 'red',
    crsMin: 524,
    invitations: 3700,
    featured: true,
  },
  {
    round: 344,
    date: '25 sep. 2024',
    categoryKey: 'catStem',
    categoryColor: 'blue',
    crsMin: 543,
    invitations: 1500,
  },
  {
    round: 343,
    date: '24 sep. 2024',
    categoryKey: 'catCanExp',
    categoryColor: 'green',
    crsMin: 491,
    invitations: 4300,
  },
  {
    round: 342,
    date: '19 sep. 2024',
    categoryKey: 'catTransport',
    categoryColor: 'amber',
    crsMin: 435,
    invitations: 1000,
  },
] as const;
