export const MARITAL_STATUSES = [
  'single',
  'married',
  'commonLaw',
  'divorced',
  'separated',
  'widowed',
  'annulled',
] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/** Only a married or common-law candidate can have spouse factors. */
export const isPartnered = (status: MaritalStatus): boolean =>
  status === 'married' || status === 'commonLaw';
