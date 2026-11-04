import { contractSentEmail } from '@/features/contracts/lib/contract-emails';
import { dossierEmail } from '@/features/dossiers/lib/dossier-emails';
import { addDays, doualaDay } from '@/features/notifications/lib/douala-days';
import { notify } from '@/features/notifications/server/notify';
import { toLocale } from '@/i18n/routing';
import type { Mailer } from '@/server/email/mailer';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** Days after sending when the Client is reminded of something still unsigned (#96), then never again. */
export const REMINDER_DAYS = [3, 7] as const;

/** How many reminders are due by `today` (Douala) for something sent at `sent`: 0, 1 or 2. */
export function remindersDue(sent: Date, today: string): number {
  const day = doualaDay(sent);
  return REMINDER_DAYS.filter((days) => addDays(day, days) <= today).length;
}

export type ReminderReport = { signatureReminders: number; contractReminders: number };

const client = { select: { id: true, name: true, email: true, locale: true } } as const;

/**
 * Reminds the Client of each Demande de signature and Contrat (or Avenant)
 * still unsigned in an open Dossier, 3 and 7 days after sending, by bell
 * and email. A late run sends only the latest reminder due; two runs at
 * once send it once, the counter being claimed before anything is sent.
 */
export async function remindUnsigned(deps: {
  db: Db;
  mailer: Mailer;
  /** The site's origin, for the emails' buttons. */
  siteUrl: string;
  now: Date;
}): Promise<ReminderReport> {
  const { db, now } = deps;
  const today = doualaDay(now);
  const report: ReminderReport = { signatureReminders: 0, contractReminders: 0 };

  const requests = await db.signatureRequest.findMany({
    where: {
      status: 'PENDING',
      reminders: { lt: REMINDER_DAYS.length },
      document: { section: { dossier: { state: 'OPEN' } } },
    },
    select: {
      id: true,
      createdAt: true,
      reminders: true,
      document: {
        select: {
          id: true,
          title: true,
          section: { select: { dossier: { select: { id: true, service: true, account: client } } } },
        },
      },
    },
  });

  for (const request of requests) {
    const due = remindersDue(request.createdAt, today);
    if (due <= request.reminders) continue;
    const { count } = await db.signatureRequest.updateMany({
      where: { id: request.id, reminders: request.reminders },
      data: { reminders: due },
    });
    if (count === 0) continue;

    const { document } = request;
    const { dossier } = document.section;
    await notify(
      db,
      {
        kind: 'SIGNATURE_REMINDER',
        actorId: null,
        recipients: [dossier.account.id],
        target: { dossierId: dossier.id, documentId: document.id },
        params: { requestId: request.id },
      },
      now,
    );
    report.signatureReminders += 1;
    const locale = toLocale(dossier.account.locale);
    try {
      await deps.mailer.send(
        dossierEmail({
          to: dossier.account.email,
          name: dossier.account.name,
          locale,
          service: dossier.service,
          change: { kind: 'signatureReminder', document: document.title },
          url: `${deps.siteUrl}/${locale}/mon-espace/dossiers/${dossier.id}/signer/${request.id}`,
        }),
      );
    } catch (error) {
      console.error('[daily] could not email a signature reminder', request.id, error);
    }
  }

  const contracts = await db.contract.findMany({
    where: { status: 'SENT', reminders: { lt: REMINDER_DAYS.length }, dossier: { state: 'OPEN' } },
    select: {
      id: true,
      number: true,
      title: true,
      parentId: true,
      sentAt: true,
      reminders: true,
      dossier: { select: { id: true, service: true, account: client } },
    },
  });

  for (const contract of contracts) {
    const due = remindersDue(contract.sentAt, today);
    if (due <= contract.reminders) continue;
    const { count } = await db.contract.updateMany({
      where: { id: contract.id, reminders: contract.reminders },
      data: { reminders: due },
    });
    if (count === 0) continue;

    const { dossier } = contract;
    await notify(
      db,
      {
        kind: 'CONTRACT_REMINDER',
        actorId: null,
        recipients: [dossier.account.id],
        target: { dossierId: dossier.id },
        params: { contractId: contract.id, number: contract.number },
      },
      now,
    );
    report.contractReminders += 1;
    const locale = toLocale(dossier.account.locale);
    try {
      await deps.mailer.send(
        contractSentEmail({
          to: dossier.account.email,
          name: dossier.account.name,
          locale,
          contract: {
            number: contract.number,
            title: contract.title,
            service: dossier.service,
            amendment: contract.parentId !== null,
          },
          reminder: true,
          url: `${deps.siteUrl}/${locale}/mon-espace/dossiers/${dossier.id}/contrats/${contract.id}`,
        }),
      );
    } catch (error) {
      console.error('[daily] could not email a Contrat reminder', contract.id, error);
    }
  }

  return report;
}
