export type FaqItem = {
  id: string;
  qKey: string;
  aKey: string;
};

export const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  { id: 'entree-express', qKey: 'q1', aKey: 'a1' },
  { id: 'score-crs', qKey: 'q2', aKey: 'a2' },
  { id: 'delai-procedure', qKey: 'q3', aKey: 'a3' },
  { id: 'services-gratuits', qKey: 'q4', aKey: 'a4' },
  { id: 'wes', qKey: 'q5', aKey: 'a5' },
  { id: 'tcf-canada', qKey: 'q6', aKey: 'a6' },
] as const;
