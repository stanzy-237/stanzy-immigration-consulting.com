import { DAY_BEFORE_MS, endsAt, SOON_MS } from '@/features/meetings/lib/meeting-schema';
import { emailClient, meetingParams } from '@/features/meetings/server/meeting-notify';
import { notify } from '@/features/notifications/server/notify';
import type { Mailer } from '@/server/email/mailer';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

export type ReminderReport = { dayBefore: number; soon: number };

/**
 * Reminds of the coming Réunions, safe to run every few minutes:
 * - the day before (the Client, bell and email), for one planned at least a
 *   day ahead; one planned later already had its email;
 * - 15 minutes before (the Client, bell and email; the consultants, bell).
 * Each reminder is claimed before it is sent, so two runs send it once.
 */
export async function remindMeetings(deps: {
  db: Db;
  mailer: Mailer;
  siteUrl: string;
  now: Date;
}): Promise<ReminderReport> {
  const { db, now } = deps;
  const report: ReminderReport = { dayBefore: 0, soon: 0 };
  const meetings = await db.meeting.findMany({
    where: {
      status: 'SCHEDULED',
      startsAt: { lte: new Date(now.getTime() + DAY_BEFORE_MS) },
      remindedSoon: null,
      dossier: { state: 'OPEN' },
    },
    select: {
      id: true,
      dossierId: true,
      subject: true,
      startsAt: true,
      durationMinutes: true,
      recording: true,
      createdAt: true,
      remindedDayBefore: true,
      dossier: { select: { account: { select: { id: true, name: true, email: true, locale: true } } } },
    },
  });

  for (const meeting of meetings) {
    const until = meeting.startsAt.getTime() - now.getTime();
    if (endsAt(meeting).getTime() < now.getTime()) continue;
    const client = meeting.dossier.account;

    if (until <= SOON_MS) {
      const { count } = await db.meeting.updateMany({
        where: { id: meeting.id, remindedSoon: null },
        data: { remindedSoon: now, remindedDayBefore: meeting.remindedDayBefore ?? now },
      });
      if (count === 0) continue;
      const params = meetingParams(meeting, { soon: 'true' });
      await notify(
        db,
        { kind: 'MEETING_REMINDER', actorId: null, recipients: [client.id], target: { dossierId: meeting.dossierId }, params },
        now,
      );
      await notify(
        db,
        { kind: 'MEETING_REMINDER', actorId: null, recipients: 'CONSULTANTS', target: { dossierId: meeting.dossierId }, params },
        now,
      );
      await emailClient(deps, client, meeting, 'soon');
      report.soon += 1;
      continue;
    }

    const plannedAhead = meeting.startsAt.getTime() - meeting.createdAt.getTime() >= DAY_BEFORE_MS;
    if (meeting.remindedDayBefore || !plannedAhead) continue;
    const { count } = await db.meeting.updateMany({
      where: { id: meeting.id, remindedDayBefore: null },
      data: { remindedDayBefore: now },
    });
    if (count === 0) continue;
    await notify(
      db,
      {
        kind: 'MEETING_REMINDER',
        actorId: null,
        recipients: [client.id],
        target: { dossierId: meeting.dossierId },
        params: meetingParams(meeting, { soon: 'false' }),
      },
      now,
    );
    await emailClient(deps, client, meeting, 'dayBefore');
    report.dayBefore += 1;
  }
  return report;
}
