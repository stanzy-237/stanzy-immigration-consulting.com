import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { dossierRefInput } from '@/features/dossiers/lib/document-schema';
import { dossierFor, isConsultant, writable } from '@/features/dossiers/server/dossier-access';
import {
  cancelMeetingInput,
  isJoinable,
  isPast,
  joinInput,
  notesInput,
  scheduleInput,
  searchInput,
  updateMeetingInput,
} from '@/features/meetings/lib/meeting-schema';
import { emailClientLater, meetingParams } from '@/features/meetings/server/meeting-notify';
import { openRoom, streamConfigured } from '@/features/meetings/server/stream';
import { notifyLater } from '@/features/notifications/server/notify';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import { appMailer } from '@/server/email/app-mailer';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/** A minute of grace: a Réunion planned for « now » isn't in the past. */
const GRACE_MS = 60 * 1000;

const mailing = () => ({ mailer: appMailer, siteUrl: siteUrl() });

/** What both sides see of a Réunion. */
const shown = {
  id: true,
  subject: true,
  startsAt: true,
  durationMinutes: true,
  recording: true,
  status: true,
  cancelReason: true,
} satisfies Prisma.MeetingSelect;

/** What the consultant sees besides: notes, Enregistrements and Transcriptions. */
const consultantOnly = {
  notes: true,
  recordings: {
    orderBy: { startedAt: 'asc' },
    select: { id: true, kind: true, startedAt: true, endedAt: true, text: true },
  },
} satisfies Prisma.MeetingSelect;

/** A Réunion with its Dossier, for someone who can reach that Dossier. */
async function meetingFor(db: Db, session: Parameters<typeof dossierFor>[1], id: string) {
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: { ...shown, dossierId: true, plannedById: true },
  });
  if (!meeting) throw notFound();
  const dossier = await dossierFor(db, session, meeting.dossierId);
  return { meeting, dossier };
}

/**
 * Réunions (#94): video meetings planned from a Dossier, held on Stream
 * Video, recorded and transcribed for the consultant only unless switched
 * off. The Client joins, never plans: they ask in the Dossier's Messages.
 */
export const meetingsRouter = createTRPCRouter({
  /** A Dossier's Réunions, newest first; notes and recordings for the consultant only. */
  forDossier: protectedProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    const consultant = isConsultant(ctx.session);
    const meetings = await ctx.prisma.meeting.findMany({
      where: { dossierId: dossier.id },
      orderBy: { startsAt: 'desc' },
      select: { ...shown, ...consultantOnly },
    });
    return {
      open: dossier.state === 'OPEN',
      configured: streamConfigured(),
      // The Client never sees the notes, Enregistrements or Transcriptions.
      meetings: consultant ? meetings : meetings.map((meeting) => ({ ...meeting, notes: null, recordings: [] })),
    };
  }),

  /** One Réunion for its room: whether it can be joined, and whether the viewer already accepted the recording. */
  room: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
    const { meeting, dossier } = await meetingFor(ctx.prisma, ctx.session, input.id);
    const consent = await ctx.prisma.meetingConsent.findUnique({
      where: { meetingId_accountId: { meetingId: meeting.id, accountId: ctx.session.account.id } },
      select: { acceptedAt: true },
    });
    const now = new Date();
    return {
      ...meeting,
      dossier: { id: dossier.id, service: dossier.service },
      joinable: meeting.status === 'SCHEDULED' && dossier.state === 'OPEN' && isJoinable(meeting, now),
      past: isPast(meeting, now),
      consentedAt: consent?.acceptedAt ?? null,
      configured: streamConfigured(),
    };
  }),

  /** The consultant plans a Réunion; the Client is told by email and bell. */
  schedule: consultantProcedure.input(scheduleInput).mutation(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    writable(dossier);
    if (input.startsAt.getTime() < Date.now() - GRACE_MS) throw refuse('MEETING_IN_PAST');
    const meeting = await ctx.prisma.meeting.create({
      data: {
        dossierId: dossier.id,
        subject: input.subject,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        recording: input.recording,
        plannedById: ctx.session.account.id,
      },
      select: { id: true, dossierId: true, subject: true, startsAt: true, durationMinutes: true, recording: true },
    });
    emailClientLater(mailing(), dossier.account, meeting, 'scheduled');
    notifyLater(ctx.prisma, {
      kind: 'MEETING_SCHEDULED',
      actorId: ctx.session.account.id,
      recipients: [dossier.accountId],
      target: { dossierId: dossier.id },
      params: meetingParams(meeting),
    });
    return { id: meeting.id };
  }),

  /**
   * Moves, renames or lengthens a Réunion, or switches its recording. A new
   * moment tells the Client again and resets the reminders.
   */
  update: consultantProcedure.input(updateMeetingInput).mutation(async ({ ctx, input }) => {
    const { meeting, dossier } = await meetingFor(ctx.prisma, ctx.session, input.id);
    writable(dossier);
    if (meeting.status !== 'SCHEDULED') throw refuse('MEETING_NOT_SCHEDULED');
    const moved =
      input.startsAt.getTime() !== meeting.startsAt.getTime() || input.durationMinutes !== meeting.durationMinutes;
    if (moved && input.startsAt.getTime() < Date.now() - GRACE_MS) throw refuse('MEETING_IN_PAST');
    const updated = await ctx.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        subject: input.subject,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        recording: input.recording,
        ...(moved ? { remindedDayBefore: null, remindedSoon: null } : {}),
      },
      select: { id: true, dossierId: true, subject: true, startsAt: true, durationMinutes: true, recording: true },
    });
    if (moved) {
      emailClientLater(mailing(), dossier.account, updated, 'moved');
      notifyLater(ctx.prisma, {
        kind: 'MEETING_MOVED',
        actorId: ctx.session.account.id,
        recipients: [dossier.accountId],
        target: { dossierId: dossier.id },
        params: meetingParams(updated),
      });
    }
  }),

  /** Cancels a Réunion, with an optional reason; the Client is told. */
  cancel: consultantProcedure.input(cancelMeetingInput).mutation(async ({ ctx, input }) => {
    const { meeting, dossier } = await meetingFor(ctx.prisma, ctx.session, input.id);
    const { count } = await ctx.prisma.meeting.updateMany({
      where: { id: meeting.id, status: 'SCHEDULED' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: input.reason || null },
    });
    if (count === 0) throw refuse('MEETING_NOT_SCHEDULED');
    const facts = { ...meeting, dossierId: dossier.id };
    emailClientLater(mailing(), dossier.account, facts, 'cancelled', input.reason || null);
    notifyLater(ctx.prisma, {
      kind: 'MEETING_CANCELLED',
      actorId: ctx.session.account.id,
      recipients: [dossier.accountId],
      target: { dossierId: dossier.id },
      params: meetingParams(facts),
    });
  }),

  /** The consultant's private notes on a Réunion. */
  saveNotes: consultantProcedure.input(notesInput).mutation(async ({ ctx, input }) => {
    const { meeting } = await meetingFor(ctx.prisma, ctx.session, input.id);
    await ctx.prisma.meeting.update({ where: { id: meeting.id }, data: { notes: input.notes.trim() || null } });
  }),

  /**
   * Lets the Dossier's Client or the consultant into the room while it is
   * open: a recorded Réunion needs their acceptance first, saved with the
   * time. Returns what the browser needs to join this call, and no other.
   */
  join: protectedProcedure.input(joinInput).mutation(async ({ ctx, input }) => {
    const { meeting, dossier } = await meetingFor(ctx.prisma, ctx.session, input.id);
    writable(dossier);
    if (meeting.status !== 'SCHEDULED') throw refuse('MEETING_NOT_SCHEDULED');
    if (!isJoinable(meeting, new Date())) throw refuse('MEETING_NOT_OPEN');
    if (!streamConfigured()) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'MEETINGS_UNCONFIGURED' });
    const account = ctx.session.account;
    if (meeting.recording) {
      const consent = await ctx.prisma.meetingConsent.findUnique({
        where: { meetingId_accountId: { meetingId: meeting.id, accountId: account.id } },
        select: { id: true },
      });
      if (!consent && !input.accepted) throw refuse('MEETING_CONSENT_REQUIRED');
      if (!consent) await ctx.prisma.meetingConsent.create({ data: { meetingId: meeting.id, accountId: account.id } });
    }

    const consultants = await ctx.prisma.account.findMany({
      where: { role: 'CONSULTANT' },
      select: { id: true, name: true },
    });
    const people = [
      { id: dossier.account.id, name: dossier.account.name, consultant: false },
      ...consultants.map((consultant) => ({ ...consultant, consultant: true })),
    ];
    const room = await openRoom({
      meeting,
      people,
      viewer: { id: account.id, name: account.name, consultant: isConsultant(ctx.session) },
      language: toLocale(dossier.account.locale),
    });
    return { ...room, user: { id: account.id, name: account.name } };
  }),

  /** The consultant searches what was said in a Dossier's Réunions. */
  search: consultantProcedure.input(searchInput).query(async ({ ctx, input }) => {
    await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    const found = await ctx.prisma.meetingRecording.findMany({
      where: {
        kind: 'TRANSCRIPTION',
        meeting: { dossierId: input.dossierId },
        text: { contains: input.query, mode: 'insensitive' },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: { id: true, text: true, meeting: { select: { id: true, subject: true, startsAt: true } } },
    });
    return found.map((row) => ({ id: row.id, meeting: row.meeting, lines: matchingLines(row.text ?? '', input.query) }));
  }),
});

/** The lines of a Transcription that say `query`, at most five. */
export function matchingLines(text: string, query: string): string[] {
  const needle = query.toLocaleLowerCase();
  return text
    .split('\n')
    .filter((line) => line.toLocaleLowerCase().includes(needle))
    .slice(0, 5);
}
