/** IRCC's levels of education, as Express Entry profiles and both calculators use them. */
export const EDUCATION_LEVELS = [
  'lessThanSecondary',
  'secondary',
  'oneYear',
  'twoYear',
  'bachelors',
  'twoOrMore',
  'masters',
  'doctorate',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
