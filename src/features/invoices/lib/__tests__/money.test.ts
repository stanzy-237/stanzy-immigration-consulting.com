import { describe, expect, it } from 'vitest';

import { displayStatus, invoiceNumber } from '@/features/invoices/lib/invoice-status';
import { formatMoney, invoiceTotal, minorToInput, toMinor } from '@/features/invoices/lib/money';

describe('amounts', () => {
  it('reads what the consultant types, in the currency’s minor unit', () => {
    expect(toMinor('150 000', 'XAF')).toBe(150000);
    expect(toMinor('1250,5', 'CAD')).toBe(125050);
    expect(toMinor('1250.50', 'EUR')).toBe(125050);
    expect(toMinor('12,5', 'XAF')).toBeNull();
    expect(toMinor('abc', 'CAD')).toBeNull();
    expect(minorToInput(125050, 'CAD')).toBe('1250.50');
  });

  it('formats with plain spaces, so the PDF font can draw it', () => {
    expect(formatMoney(150000, 'XAF', 'fr')).toBe('150 000 FCFA');
    expect(formatMoney(125050, 'EUR', 'fr')).toBe('1 250,50 €');
    expect(formatMoney(125050, 'CAD', 'en')).toBe('CA$1,250.50');
  });

  it('adds up the lines', () => {
    expect(
      invoiceTotal([
        { quantity: 3, unitAmount: 12500 },
        { quantity: 1, unitAmount: 40000 },
      ]),
    ).toBe(77500);
  });
});

describe('statuses and numbers', () => {
  const due = new Date('2026-11-15T00:00:00Z');
  it('reads a sent invoice as En retard once its due day is over', () => {
    expect(displayStatus({ status: 'SENT', dueDate: due }, new Date('2026-11-15T22:00:00Z'))).toBe('SENT');
    expect(displayStatus({ status: 'SENT', dueDate: due }, new Date('2026-11-16T00:00:00Z'))).toBe('OVERDUE');
  });

  it('keeps « Preuve reçue » and never-due invoices as they are', () => {
    expect(displayStatus({ status: 'PROOF_RECEIVED', dueDate: due }, new Date('2026-12-01'))).toBe('PROOF_RECEIVED');
    expect(displayStatus({ status: 'SENT', dueDate: null }, new Date('2030-01-01'))).toBe('SENT');
  });

  it('numbers invoices per year', () => {
    expect(invoiceNumber(2026, 7)).toBe('STZ-2026-0007');
  });
});
