import { DEFAULT_RATES, type Currency } from '@/features/budget/data/currencies';
import {
  BIOMETRICS_FAMILY_CAP,
  ESTIMATED_FEES,
  FUNDS_PER_EXTRA_PERSON,
  FUNDS_TABLE,
  OFFICIAL_FEES,
  type EditableLine,
  type FeeDefinition,
  type LineBasis,
  type LineSource,
} from '@/features/budget/data/fees';
import type { BudgetAnswers } from '@/features/budget/lib/budget-schema';

/** How many units of each currency 1 CAD buys. */
export type Rates = Record<Currency, number>;

export type LineKey = keyof typeof OFFICIAL_FEES | EditableLine;

/** One line of « Frais à payer ». */
export type BudgetLine = {
  key: LineKey;
  /** Message key under `Budget.lines`. */
  labelKey: LineKey;
  /** One person's price, in `unitCurrency`. */
  unitAmount: number;
  unitCurrency: Currency;
  /** How many times the line counts (persons, test-takers, …). */
  count: number;
  /** The line's total in the estimate's currency, in whole units. */
  amount: number;
  /** The estimate's currency. */
  currency: Currency;
  perPerson: boolean;
  editable: boolean;
  source: LineSource;
  checkedOn: string;
};

export type FundsToProve = {
  persons: number;
  /** IRCC's figure, in CAD. */
  cad: number;
  /** The same, in the estimate's currency, in whole units. */
  amount: number;
};

export type BudgetEstimate = {
  currency: Currency;
  fees: BudgetLine[];
  /** The fees only: the proof of funds is money kept, never added here. */
  feesTotal: number;
  fundsToProve: FundsToProve | 'exempt';
};

/** The default rates, with the User's own rate for the estimate's currency. */
export function ratesFor(answers: Pick<BudgetAnswers, 'currency' | 'rate'>): Rates {
  return answers.rate === null ? DEFAULT_RATES : { ...DEFAULT_RATES, [answers.currency]: answers.rate };
}

/** Converts through CAD, the currency every rate is quoted against. */
export function convert(amount: number, from: Currency, to: Currency, rates: Rates): number {
  return from === to ? amount : (amount / rates[from]) * rates[to];
}

/** IRCC's settlement funds for a family of `persons`, in CAD. */
export function fundsFor(persons: number): number {
  const table: readonly number[] = FUNDS_TABLE;
  const last = table.length;
  return persons <= last
    ? table[Math.max(1, persons) - 1]!
    : table[last - 1]! + (persons - last) * FUNDS_PER_EXTRA_PERSON;
}

/**
 * What an Entrée Express application costs a family, line by line, in the
 * answers' currency, and the settlement funds it must show IRCC, apart.
 */
export function estimateBudget(answers: BudgetAnswers, rates: Rates): BudgetEstimate {
  const target = answers.currency;
  const adults = answers.spouse ? 2 : 1;
  const persons = adults + answers.children;
  const counts: Record<LineBasis, number> = {
    adult: adults,
    child: answers.children,
    person: persons,
    // After the ITA, tests and diploma evaluations are already done.
    assessed: answers.itaReceived ? 0 : Number(answers.ecaPrincipal) + Number(answers.spouse && answers.ecaSpouse),
    testTaker: answers.itaReceived ? 0 : Number(answers.test !== 'none') + Number(answers.spouse && answers.spouseTest),
  };
  const inTarget = (amount: number, from: Currency) => Math.round(convert(amount, from, target, rates));

  const line = (key: LineKey, fee: FeeDefinition, editable: boolean): BudgetLine => {
    const count = counts[fee.basis];
    return {
      key,
      labelKey: key,
      unitAmount: fee.amount,
      unitCurrency: fee.currency,
      count,
      amount: inTarget(fee.amount * count, fee.currency),
      currency: target,
      perPerson: true,
      editable,
      source: fee.source,
      checkedOn: fee.checkedOn,
    };
  };

  const official = (Object.keys(OFFICIAL_FEES) as (keyof typeof OFFICIAL_FEES)[]).map((key) => {
    const built = line(key, OFFICIAL_FEES[key], false);
    if (key !== 'biometrics') return built;
    const capped = Math.min(OFFICIAL_FEES.biometrics.amount * persons, BIOMETRICS_FAMILY_CAP);
    return { ...built, perPerson: false, amount: inTarget(capped, 'CAD') };
  });

  const estimated = (Object.keys(ESTIMATED_FEES) as EditableLine[]).map((key) => {
    const edited = answers.lines[key];
    const fee: FeeDefinition = edited ? { ...ESTIMATED_FEES[key], ...edited } : ESTIMATED_FEES[key];
    return line(key, fee, true);
  });

  const fees = [...official, ...estimated].filter((l) => l.count > 0);
  const cad = fundsFor(persons);

  return {
    currency: target,
    fees,
    feesTotal: fees.reduce((sum, l) => sum + l.amount, 0),
    fundsToProve: answers.fundsExempt ? 'exempt' : { persons, cad, amount: inTarget(cad, 'CAD') },
  };
}
