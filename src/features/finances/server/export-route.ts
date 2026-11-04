import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';

import { isConsultant } from '@/features/dossiers/server/dossier-access';
import { toCsv } from '@/features/finances/lib/csv';
import { monthOf, toXaf } from '@/features/finances/lib/finance-report';
import { yearInput } from '@/features/finances/lib/finance-schema';
import { dateOf, dayOf, loadRates } from '@/features/finances/server/finance-entries';
import { minorDigits, type Currency } from '@/features/invoices/lib/money';
import { doualaDay } from '@/features/notifications/lib/douala-days';
import { invoiceTotal } from '@/features/invoices/lib/money';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { getCurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const MESSAGES = { fr, en } as const;

/** 125050 (CAD) → "1250.50": a plain number a spreadsheet reads. */
const plain = (minor: number, currency: Currency): string =>
  (minor / 10 ** minorDigits(currency)).toFixed(minorDigits(currency));

/**
 * GET /api/finances/export?year=2026&locale=fr: the year's Recettes and
 * Charges, one per line, with their XAF value, for an accountant. The
 * consultant only.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getCurrentSession(request.headers);
  if (!session || !isConsultant(session)) return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const parsed = yearInput.safeParse({ year: Number(url.searchParams.get('year')) });
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { year } = parsed.data;
  const locale = toLocale(url.searchParams.get('locale'));
  const t = createTranslator({ locale, messages: MESSAGES[locale] });

  const days = { gte: dateOf(`${year}-01-01`), lt: dateOf(`${year + 1}-01-01`) };
  const client = { select: { account: { select: { name: true } } } } as const;
  const [rates, invoices, incomes, charges] = await Promise.all([
    loadRates(prisma),
    prisma.invoice.findMany({
      where: {
        status: 'PAID',
        paidAt: { gte: new Date(`${year}-01-01T00:00:00+01:00`), lt: new Date(`${year + 1}-01-01T00:00:00+01:00`) },
      },
      select: {
        number: true,
        currency: true,
        paidAt: true,
        lines: { select: { quantity: true, unitAmount: true } },
        dossier: { select: { service: true, account: { select: { name: true } } } },
      },
    }),
    prisma.income.findMany({
      where: { date: days },
      select: { amount: true, currency: true, date: true, service: true, source: true, note: true, dossier: client },
    }),
    prisma.charge.findMany({
      where: { date: days },
      select: {
        amount: true,
        currency: true,
        date: true,
        note: true,
        category: { select: { name: true } },
        dossier: client,
      },
    }),
  ]);

  type Line = {
    day: string;
    kind: 'income' | 'charge';
    amount: number;
    currency: Currency;
    label: string;
    client: string;
    invoice: string;
    note: string;
  };
  const service = (value: string | null) => (value ? t(`Dossiers.services.${value as 'EDE'}`) : '');
  const lines: Line[] = [
    ...invoices.map((invoice) => ({
      day: doualaDay(invoice.paidAt!),
      kind: 'income' as const,
      amount: invoiceTotal(invoice.lines),
      currency: invoice.currency,
      label: service(invoice.dossier.service),
      client: invoice.dossier.account.name,
      invoice: invoice.number ?? '',
      note: '',
    })),
    ...incomes.map((income) => ({
      day: dayOf(income.date),
      kind: 'income' as const,
      amount: income.amount,
      currency: income.currency,
      label: income.service ? service(income.service) : (income.source ?? ''),
      client: income.dossier?.account.name ?? '',
      invoice: '',
      note: income.note ?? '',
    })),
    ...charges.map((charge) => ({
      day: dayOf(charge.date),
      kind: 'charge' as const,
      amount: charge.amount,
      currency: charge.currency,
      label: charge.category.name,
      client: charge.dossier?.account.name ?? '',
      invoice: '',
      note: charge.note ?? '',
    })),
  ].sort((a, b) => a.day.localeCompare(b.day));

  const csv = toCsv([
    (['date', 'type', 'amount', 'currency', 'xaf', 'label', 'client', 'invoice', 'note'] as const).map((column) =>
      t(`Finances.csv.${column}`),
    ),
    ...lines.map((line) => {
      const xaf = toXaf(line.amount, line.currency, monthOf(line.day), rates);
      return [
        line.day,
        t(`Finances.csv.${line.kind}`),
        plain(line.amount, line.currency),
        line.currency,
        xaf === null ? '' : xaf,
        line.label,
        line.client,
        line.invoice,
        line.note,
      ];
    }),
  ]);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finances-${year}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
