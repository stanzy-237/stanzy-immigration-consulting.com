import { DAY_BEFORE_MS, endsAt, SOON_MS } from '@/features/meetings/lib/meeting-schema';
import { emailParticipant, meetingParams } from '@/features/meetings/server/meeting-notify';
import { notify } from '@/features/notifications/server/notify';
import type { Mailer } from '@/server/email/mailer';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

export type ReminderReport = { dayBefore: number; soon: number };

/**
 * Reminds of the coming planned Réunions, safe to run every few minutes:
 * - the day before (those invited, bell and email), for one planned at
 *   least a day ahead; one planned later already had its email;
 * - 15 minutes before (those invited, bell and email; the consultants, bell).
 * Each reminder is claimed before it is sent, so two runs send it once.
 * Instant Réunions and the Salle personnelle get none.
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
      kind: 'SCHEDULED',
      status: 'SCHEDULED',
      endedAt: null,
      startsAt: { lte: new Date(now.getTime() + DAY_BEFORE_MS) },
      remindedSoon: null,
      OR: [{ dossierId: null }, { dossier: { state: 'OPEN' } }],
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
      participants: { select: { account: { select: { id: true, name: true, email: true, locale: true } } } },
    },
  });

  for (const meeting of meetings) {
    const until = meeting.startsAt.getTime() - now.getTime();
    if (endsAt(meeting).getTime() < now.getTime()) continue;
    const invited = meeting.participants.map(({ account }) => account);
    const target = meeting.dossierId ? { dossierId: meeting.dossierId } : {};

    if (until <= SOON_MS) {
      const { count } = await db.meeting.updateMany({
        where: { id: meeting.id, remindedSoon: null },
        data: { remindedSoon: now, remindedDayBefore: meeting.remindedDayBefore ?? now },
      });
      if (count === 0) continue;
      const params = meetingParams(meeting, { soon: 'true' });
      if (invited.length > 0) {
        await notify(db, { kind: 'MEETING_REMINDER', actorId: null, recipients: invited.map(({ id }) => id), target, params }, now);
      }
      await notify(db, { kind: 'MEETING_REMINDER', actorId: null, recipients: 'CONSULTANTS', target, params }, now);
      for (const person of invited) await emailParticipant(deps, person, meeting, 'soon');
      report.soon += 1;
      continue;
    }

    const plannedAhead = meeting.startsAt.getTime() - meeting.createdAt.getTime() >= DAY_BEFORE_MS;
    if (meeting.remindedDayBefore || !plannedAhead || invited.length === 0) continue;
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
        recipients: invited.map(({ id }) => id),
        target,
        params: meetingParams(meeting, { soon: 'false' }),
      },
      now,
    );
    for (const person of invited) await emailParticipant(deps, person, meeting, 'dayBefore');
    report.dayBefore += 1;
  }
  return report;
}
