// ─── To update every month ───────────────────────────────────────────────────
/**
 * The IOM's price grid for the immigration medical in Cameroon, in FCFA. The
 * IOM publishes a new one each month (it follows the CAD rate): change
 * `month` (YYYY-MM) and the three prices. The estimator's default « Visite
 * médicale » price is the « 15 ans et plus » one, and the medical guide shows
 * the whole grid.
 */
export const IOM_MEDICAL_GRID = {
  month: '2026-10',
  prices: [
    { fromAge: 0, ages: { fr: '0 à 10 ans', en: '0 to 10 years' }, xaf: 63_625 },
    { fromAge: 11, ages: { fr: '11 à 14 ans', en: '11 to 14 years' }, xaf: 89_650 },
    { fromAge: 15, ages: { fr: '15 ans et plus', en: '15 and over' }, xaf: 114_520 },
  ],
} as const;

/** Where the IOM's medical is paid, in Cameroon. */
export const IOM_MEDICAL_PAYMENT = {
  accountNumber: '30830023091',
  bankName: 'Ecobank - CAMEROON',
  accountName: 'OIM',
  reference: 'MH.0130',
} as const;
// ──────────────────────────────────────────────────────────────────────────────

/** The grid's price from 15: what the estimator counts per person. */
export const IOM_PRICE_FROM_15 = IOM_MEDICAL_GRID.prices.find((row) => row.fromAge === 15)!.xaf;

/** The first day of the grid's month, `YYYY-MM-DD`: when its prices were set. */
export const IOM_GRID_DAY = `${IOM_MEDICAL_GRID.month}-01`;
