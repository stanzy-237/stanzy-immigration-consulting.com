import type { Currency } from '@/features/budget/data/currencies';
import { IOM_GRID_DAY, IOM_PRICE_FROM_15 } from '@/features/budget/data/iom-medical';

export const LANGUAGE_TESTS = ['TEF', 'TCF', 'IELTS', 'CELPIP'] as const;

/** Who a line is paid for, which decides how many times it counts. */
export type LineBasis = 'adult' | 'child' | 'person' | 'assessed' | 'testTaker';

/** Where a price comes from; no URL when Stanzy estimated it. */
export type LineSource = { name: string; url?: string };

export type FeeDefinition = {
  /** One person's price, in `currency`. */
  amount: number;
  currency: Currency;
  basis: LineBasis;
  source: LineSource;
  /** When the price was last checked, `YYYY-MM-DD`. */
  checkedOn: string;
};

const IRCC: LineSource = {
  name: 'IRCC',
  url: 'https://ircc.canada.ca/francais/information/frais/frais.asp',
};
/** IRCC's fee list in force since 30 April 2026. */
const IRCC_CHECKED_ON = '2026-04-30';

/**
 * IRCC's fees for an Entrée Express application. Official and fixed: the
 * estimator never lets them be edited.
 */
export const OFFICIAL_FEES = {
  /** Processing fee, principal applicant and accompanying spouse. */
  processing: { amount: 990, currency: 'CAD', basis: 'adult', source: IRCC, checkedOn: IRCC_CHECKED_ON },
  /** Right of permanent residence fee (RPRF), adults only. */
  rprf: { amount: 600, currency: 'CAD', basis: 'adult', source: IRCC, checkedOn: IRCC_CHECKED_ON },
  /** Processing fee per dependent child; children pay no RPRF. */
  childProcessing: { amount: 270, currency: 'CAD', basis: 'child', source: IRCC, checkedOn: IRCC_CHECKED_ON },
  biometrics: { amount: 85, currency: 'CAD', basis: 'person', source: IRCC, checkedOn: IRCC_CHECKED_ON },
} as const satisfies Record<string, FeeDefinition>;

/** Biometrics never cost a family applying together more than this (CAD). */
export const BIOMETRICS_FAMILY_CAP = 170;

export const EDITABLE_LINES = ['eca', 'languageTest', 'medical', 'police', 'passport', 'photos'] as const;
export type EditableLine = (typeof EDITABLE_LINES)[number];

const STANZY_ESTIMATE: LineSource = { name: 'Estimation Stanzy' };
const IOM: LineSource = { name: 'OIM (grille mensuelle)', url: 'https://mymedical.iom.int/apps/omas/#_frmHomeV2' };
const POLICE_ESTIMATED_ON = '2026-10-28';
const ESTIMATED_ON = '2026-10-27';

/**
 * Prices that vary by country and provider: defaults for Cameroon, which the
 * User can replace with what they actually pay.
 */
export const ESTIMATED_FEES = {
  /** WES ECA: 264 CAD, plus delivery and tax. */
  eca: {
    amount: 300,
    currency: 'CAD',
    basis: 'assessed',
    source: { name: 'WES Canada', url: 'https://www.wes.org/ca/fees/' },
    checkedOn: ESTIMATED_ON,
  },
  /** IELTS in Cameroon is 206 000–217 000 XAF; TCF about 210 000 XAF. */
  languageTest: {
    amount: 210_000,
    currency: 'XAF',
    basis: 'testTaker',
    source: { name: 'British Council Cameroun', url: 'https://www.britishcouncil.cm/examen/ielts' },
    checkedOn: ESTIMATED_ON,
  },
  /** No published price for a panel physician in Cameroon. */
  /**
   * The IOM's monthly price from 15 (iom-medical.ts), for everyone: the
   * estimator doesn't know children's ages, and younger ones cost less.
   */
  medical: { amount: IOM_PRICE_FROM_15, currency: 'XAF', basis: 'person', source: IOM, checkedOn: IOM_GRID_DAY },
  /** IRCC asks one from each family member aged 18 or over. */
  police: { amount: 25_000, currency: 'XAF', basis: 'adult', source: STANZY_ESTIMATE, checkedOn: POLICE_ESTIMATED_ON },
  passport: { amount: 110_000, currency: 'XAF', basis: 'person', source: STANZY_ESTIMATE, checkedOn: ESTIMATED_ON },
  photos: { amount: 5_000, currency: 'XAF', basis: 'person', source: STANZY_ESTIMATE, checkedOn: ESTIMATED_ON },
} as const satisfies Record<EditableLine, FeeDefinition>;

/**
 * IRCC's settlement funds (CAD) by family size, 1 to 7 persons, in force since
 * 7 July 2025. IRCC updates the table every year, usually in summer:
 * re-check it before launch and each summer.
 */
export const FUNDS_TABLE = [15_263, 19_001, 23_360, 28_362, 32_168, 36_280, 40_392] as const;
/** Added for each person beyond seven (CAD). */
export const FUNDS_PER_EXTRA_PERSON = 4_112;
export const FUNDS_SOURCE: LineSource = {
  name: 'IRCC',
  url: 'https://ircc.canada.ca/francais/immigrer-canada/entree-express/admissibilite/fonds.asp',
};
export const FUNDS_CHECKED_ON = '2025-07-07';
