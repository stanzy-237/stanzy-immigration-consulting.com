import { describe, expect, it } from 'vitest';

import { toCsv } from '@/features/finances/lib/csv';
import { dossierMargins, toXaf, yearReport, type Entry } from '@/features/finances/lib/finance-report';
import { dayInput, incomeInput } from '@/features/finances/lib/finance-schema';
import { financeYear } from '@/features/finances/lib/finance-year';
import { addMonths, copiesDue } from '@/features/finances/lib/repeat';

const income = (day: string, amount: number, extra: Partial<Entry> = {}): Entry => ({
  kind: 'income',
  day,
  amount,
  currency: 'XAF',
  ...extra,
});
const charge = (day: string, amount: number, extra: Partial<Entry> = {}): Entry => ({
  kind: 'charge',
  day,
  amount,
  currency: 'XAF',
  category: 'Loyer',
  ...extra,
});

describe('toXaf', () => {
  it('keeps XAF, converts EUR at 655.957 and CAD at the month’s rate', () => {
    expect(toXaf(250_000, 'XAF', '2026-03', {})).toBe(250_000);
    expect(toXaf(10_000, 'EUR', '2026-03', {})).toBe(65_596);
    expect(toXaf(10_000, 'CAD', '2026-03', { '2026-03': 440.5 })).toBe(44_050);
  });

  it('has no XAF value for CAD without the month’s rate', () => {
    expect(toXaf(10_000, 'CAD', '2026-04', { '2026-03': 440 })).toBeNull();
  });
});

describe('yearReport', () => {
  it('puts Recettes against Charges per month, service and category', () => {
    const report = yearReport(
      [
        income('2026-01-15', 300_000, { service: 'ACCOMPAGNEMENT' }),
        income('2026-01-20', 10_000, { currency: 'EUR', service: 'EDE' }),
        income('2026-03-02', 50_000, { source: 'Formation' } as Partial<Entry>),
        charge('2026-01-05', 100_000),
        charge('2026-03-05', 20_000, { category: 'Internet & téléphone' }),
        income('2025-12-31', 999_999, { service: 'EDE' }),
      ],
      {},
      2026,
    );
    expect(report.total).toEqual({ income: 415_596, charges: 120_000, net: 295_596 });
    expect(report.months[0]).toEqual({ income: 365_596, charges: 100_000, net: 265_596 });
    expect(report.months[1]).toEqual({ income: 0, charges: 0, net: 0 });
    expect(report.months[2]).toEqual({ income: 50_000, charges: 20_000, net: 30_000 });
    expect(report.byService).toEqual([
      { service: 'ACCOMPAGNEMENT', income: 300_000 },
      { service: 'EDE', income: 65_596 },
      { service: null, income: 50_000 },
    ]);
    expect(report.byCategory).toEqual([
      { category: 'Loyer', charges: 100_000 },
      { category: 'Internet & téléphone', charges: 20_000 },
    ]);
    expect(report.missingRates).toEqual([]);
  });

  it('leaves out CAD amounts of a month without a rate, and names that month', () => {
    const report = yearReport(
      [income('2026-02-10', 100_000, { currency: 'CAD' }), income('2026-05-10', 100_000, { currency: 'CAD' })],
      { '2026-05': 450 },
      2026,
    );
    expect(report.total.income).toBe(450_000);
    expect(report.missingRates).toEqual(['2026-02']);
  });
});

describe('dossierMargins', () => {
  it('gives each Dossier what it brought in, cost and its margin, biggest first', () => {
    expect(
      dossierMargins(
        [
          income('2026-01-15', 300_000, { dossierId: 'dos_1' }),
          charge('2026-01-16', 120_000, { dossierId: 'dos_1' }),
          income('2026-02-01', 500_000, { dossierId: 'dos_2' }),
          charge('2026-02-02', 50_000),
        ],
        {},
      ),
    ).toEqual([
      { dossierId: 'dos_2', income: 500_000, charges: 0, net: 500_000 },
      { dossierId: 'dos_1', income: 300_000, charges: 120_000, net: 180_000 },
    ]);
  });
});

describe('copiesDue', () => {
  it('copies a monthly Charge once a month, from the month after, once its day comes', () => {
    expect(copiesDue('2026-01-05', '2026-03-04')).toEqual([{ month: '2026-02', day: '2026-02-05' }]);
    expect(copiesDue('2026-01-05', '2026-03-05')).toEqual([
      { month: '2026-02', day: '2026-02-05' },
      { month: '2026-03', day: '2026-03-05' },
    ]);
    expect(copiesDue('2026-01-05', '2026-01-31')).toEqual([]);
  });

  it('moves the 31st to the month’s last day, across a year', () => {
    expect(copiesDue('2025-12-31', '2026-02-28')).toEqual([
      { month: '2026-01', day: '2026-01-31' },
      { month: '2026-02', day: '2026-02-28' },
    ]);
  });

  it('never makes more than the last 24', () => {
    const copies = copiesDue('2020-01-10', '2026-11-10');
    expect(copies).toHaveLength(24);
    expect(copies.at(-1)).toEqual({ month: '2026-11', day: '2026-11-10' });
  });

  it('adds months across years', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', 23)).toBe('2027-12');
  });
});

describe('inputs', () => {
  it('takes only days that exist', () => {
    expect(dayInput.safeParse('2026-02-28').success).toBe(true);
    expect(dayInput.safeParse('2026-02-30').success).toBe(false);
    expect(dayInput.safeParse('28/02/2026').success).toBe(false);
  });

  it('needs a service or a source for a Recette', () => {
    const base = { amount: 1000, currency: 'XAF', day: '2026-02-01', dossierId: null, note: null } as const;
    expect(incomeInput.safeParse({ ...base, service: 'EDE', source: null }).success).toBe(true);
    expect(incomeInput.safeParse({ ...base, service: null, source: 'Formation' }).success).toBe(true);
    expect(incomeInput.safeParse({ ...base, service: null, source: '  ' }).success).toBe(false);
  });

  it('reads the year from ?annee=, else this year in Douala', () => {
    expect(financeYear('2025')).toBe(2025);
    expect(financeYear(['2024', '2023'])).toBe(2024);
    expect(financeYear('abc', new Date('2026-12-31T23:30:00Z'))).toBe(2027);
    expect(financeYear('1999', new Date('2026-06-01T12:00:00Z'))).toBe(2026);
  });
});

describe('toCsv', () => {
  it('writes a CSV a French spreadsheet opens: BOM, semicolons, quotes where needed', () => {
    expect(toCsv([['Date', 'Note'], ['2026-01-05', 'Loyer; janvier'], ['2026-01-06', 'Dit "oui"']])).toBe(
      '﻿Date;Note\r\n2026-01-05;"Loyer; janvier"\r\n2026-01-06;"Dit ""oui"""\r\n',
    );
  });
});
