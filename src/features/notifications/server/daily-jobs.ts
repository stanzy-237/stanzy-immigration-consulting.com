import { Prisma } from '@prisma/client';

import { makeMonthlyCopies } from '@/features/finances/server/repeat-charges';
import { invoiceReminderEmail } from '@/features/invoices/lib/invoice-emails';
import { invoiceTotal } from '@/features/invoices/lib/money';
import { addDays, doualaDay } from '@/features/notifications/lib/douala-days';
import { notify } from '@/features/notifications/server/notify';
import { purgeOldPdfToolFiles } from '@/features/pdf-tools/server/purge';
import { remindUnsigned } from '@/features/signatures/server/sign-reminders';
import { toLocale } from '@/i18n/routing';
import type { Mailer } from '@/server/email/mailer';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

const DAY_MS = 24 * 60 * 60 * 1000;
/** Read Notifications older than this are deleted (#92); unread ones stay. */
export const READ_KEPT_MS = 183 * DAY_MS;

export { doualaDay };

/** The calendar day a due date stands for: stored at midnight UTC of the day picked. */
const dueDay = (dueDate: Date): string => dueDate.toISOString().slice(0, 10);

export type DailyReport = {
  dueSoon: number;
  overdue: number;
  /** Demandes de signature and Contrats still unsigned, reminded to the Client. */
  signatureReminders: number;
  contractReminders: number;
  signups: number | null;
  deleted: number;
  /** Outils PDF history files past 90 days. */
  pdfFilesPurged: number;
  /** Monthly Charges copied into this month (#95). */
  chargesRepeated: number;
};

/**
 * The daily round (#92), safe to run more than once a day:
 * - Factures still « Envoyée »: the Client is reminded 3 days before the due
 *   date and on the day after it (bell and email), and the consultant told
 *   it is « En retard »; each reminder once, a late run catching up.
 * - Demandes de signature and Contrats still unsigned: the Client is reminded
 *   3 and 7 days after sending (bell and email), then never again.
 * - The accounts created the day before, summed up for the consultant, once a day.
 * - Read Notifications older than 6 months, deleted.
 * - Outils PDF history files older than 90 days, deleted with their copies.
 * - Monthly Charges, copied into this month once their day comes (#95).
 */
export async function runDailyJobs(deps: {
  db: Db;
  mailer: Mailer;
  /** The site's origin, for the emails' buttons. */
  siteUrl: string;
  now: Date;
}): Promise<DailyReport> {
  const { db, now } = deps;
  const today = doualaDay(now);
  const report: DailyReport = {
    dueSoon: 0,
    overdue: 0,
    signatureReminders: 0,
    contractReminders: 0,
    signups: null,
    deleted: 0,
    pdfFilesPurged: 0,
    chargesRepeated: 0,
  };

  const invoices = await db.invoice.findMany({
    where: { status: 'SENT', dueDate: { not: null }, overdueRemindedAt: null },
    select: {
      id: true,
      number: true,
      currency: true,
      dueDate: true,
      dueSoonRemindedAt: true,
      lines: { select: { quantity: true, unitAmount: true } },
      dossier: {
        select: { id: true, service: true, account: { select: { id: true, name: true, email: true, locale: true } } },
      },
    },
  });

  for (const invoice of invoices) {
    const day = dueDay(invoice.dueDate!);
    const overdue = day < today;
    const dueSoon = !overdue && !invoice.dueSoonRemindedAt && day <= addDays(today, 3);
    if (!overdue && !dueSoon) continue;

    const { dossier } = invoice;
    const client = dossier.account;
    const target = { dossierId: dossier.id, invoiceId: invoice.id };
    await notify(
      db,
      {
        kind: overdue ? 'INVOICE_OVERDUE' : 'INVOICE_DUE_SOON',
        actorId: null,
        recipients: [client.id],
        target,
      },
      now,
    );
    if (overdue) {
      await notify(
        db,
        {
          kind: 'INVOICE_LATE',
          actorId: null,
          recipients: 'CONSULTANTS',
          target,
          params: { client: client.name },
        },
        now,
      );
    }
    await db.invoice.update({
      where: { id: invoice.id },
      data: overdue
        ? { overdueRemindedAt: now, dueSoonRemindedAt: invoice.dueSoonRemindedAt ?? now }
        : { dueSoonRemindedAt: now },
    });
    if (overdue) report.overdue += 1;
    else report.dueSoon += 1;

    try {
      const locale = toLocale(client.locale);
      await deps.mailer.send(
        invoiceReminderEmail({
          to: client.email,
          name: client.name,
          locale,
          kind: overdue ? 'overdue' : 'dueSoon',
          invoice: {
            number: invoice.number ?? '',
            total: invoiceTotal(invoice.lines),
            currency: invoice.currency,
            dueDate: invoice.dueDate,
            service: dossier.service,
          },
          url: `${deps.siteUrl}/${locale}/mon-espace/dossiers/${dossier.id}#factures`,
        }),
      );
    } catch (error) {
      console.error('[daily] could not email a Facture reminder', invoice.id, error);
    }
  }

  Object.assign(report, await remindUnsigned(deps));
  report.signups = await summarizeSignups(db, now, addDays(today, -1));

  const { count } = await db.notification.deleteMany({
    where: { readAt: { lt: new Date(now.getTime() - READ_KEPT_MS) } },
  });
  report.deleted = count;
  report.pdfFilesPurged = await purgeOldPdfToolFiles(db, now);
  report.chargesRepeated = await makeMonthlyCopies(db, today);
  return report;
}

/**
 * Tells the consultant how many Accounts were created on `day` (Douala),
 * once: a second run the same day finds the day already done. Null when it
 * was; 0 sends nothing.
 */
async function summarizeSignups(db: Db, now: Date, day: string): Promise<number | null> {
  try {
    await db.cronRun.create({ data: { job: 'accounts-summary', day } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
    throw error;
  }
  const start = new Date(`${day}T00:00:00+01:00`);
  const count = await db.account.count({
    where: { role: 'MEMBER', createdAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) } },
  });
  if (count > 0) {
    await notify(
      db,
      {
        kind: 'ACCOUNTS_SIGNED_UP',
        actorId: null,
        recipients: 'CONSULTANTS',
        target: {},
        params: { count: String(count), day },
      },
      now,
    );
  }
  return count;
}
