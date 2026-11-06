import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { dossierRefInput } from '@/features/dossiers/lib/document-schema';
import { dossierFor, isConsultant, writable } from '@/features/dossiers/server/dossier-access';
import {
  cancelMeetingInput,
  decideRequestInput,
  INSTANT_MINUTES,
  instantInput,
  isJoinable,
  isPast,
  joinInput,
  meetingListInput,
  newInviteToken,
  notesInput,
  peopleSearchInput,
  scheduleInput,
  searchInput,
  tokenInput,
  updateMeetingInput,
} from '@/features/meetings/lib/meeting-schema';
import {
  emailParticipantsLater,
  meetingParams,
  type MeetingFacts,
  type Person,
} from '@/features/meetings/server/meeting-notify';
import { syncMeetingFiles } from '@/features/meetings/server/meeting-files';
import { endRoom, openRoom, streamConfigured } from '@/features/meetings/server/stream';
import { notifyLater } from '@/features/notifications/server/notify';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import type { CurrentSession } from '@/server/auth/session';
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
const person = { select: { id: true, name: true, email: true, locale: true, role: true } } as const;

/** What everyone invited sees of a Réunion. */
const shown = {
  id: true,
  kind: true,
  subject: true,
  description: true,
  startsAt: true,
  durationMinutes: true,
  recording: true,
  status: true,
  endedAt: true,
  cancelReason: true,
  dossierId: true,
  participants: { orderBy: { createdAt: 'asc' }, select: { account: person } },
} satisfies Prisma.MeetingSelect;

/** What only the consultant sees besides: the link, notes, Enregistrements and Transcriptions, the Dossier. */
const consultantOnly = {
  inviteToken: true,
  notes: true,
  plannedById: true,
  dossier: { select: { id: true, service: true, account: { select: { name: true } } } },
  recordings: {
    orderBy: { startedAt: 'asc' },
    select: { id: true, kind: true, startedAt: true, endedAt: true, text: true },
  },
} satisfies Prisma.MeetingSelect;

type Shown = Prisma.MeetingGetPayload<{ select: typeof shown }>;

const people = (meeting: Shown): Person[] => meeting.participants.map(({ account }) => account);
const facts = (meeting: Shown): MeetingFacts => meeting;

/** A Réunion `session` may reach: the consultant, or someone invited. Else NOT_FOUND, as if it didn't exist. */
async function meetingFor(db: Db, session: CurrentSession, id: string) {
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: { ...shown, plannedById: true, dossier: { select: { state: true } } },
  });
  if (!meeting) throw notFound();
  if (!isConsultant(session) && !meeting.participants.some(({ account }) => account.id === session.account.id)) {
    throw notFound();
  }
  return meeting;
}

/** The accounts to invite: Clients and partners only, each existing; the Dossier's Client always among them. */
async function invitees(db: Db, ids: string[], dossierAccountId: string | null): Promise<string[]> {
  const wanted = [...new Set([...(dossierAccountId ? [dossierAccountId] : []), ...ids])];
  if (wanted.length === 0) return [];
  const found = await db.account.findMany({
    where: { id: { in: wanted }, role: { in: ['MEMBER', 'PARTNER'] } },
    select: { id: true },
  });
  if (found.length !== wanted.length) throw refuse('MEETING_PARTICIPANT_UNKNOWN');
  return wanted;
}

/** Tells people about a Réunion: an email each, and the bell. */
function tell(
  db: Db,
  actorId: string,
  meeting: Shown,
  to: Person[],
  kind: 'scheduled' | 'instant' | 'moved' | 'cancelled',
  reason?: string | null,
) {
  emailParticipantsLater(mailing(), to, facts(meeting), kind, reason);
  if (to.length === 0) return;
  notifyLater(db, {
    kind: kind === 'moved' ? 'MEETING_MOVED' : kind === 'cancelled' ? 'MEETING_CANCELLED' : 'MEETING_SCHEDULED',
    actorId,
    recipients: to.map(({ id }) => id),
    target: meeting.dossierId ? { dossierId: meeting.dossierId } : {},
    params: meetingParams(facts(meeting)),
  });
}

/**
 * Réunions (#94): video meetings on Stream Video, recorded and transcribed
 * for the consultant only unless switched off. Planned ahead, started at
 * once, or in the consultant's Salle personnelle; about a Dossier or not.
 * Everyone has an account: those invited join, others with the link ask and
 * wait until the consultant lets them in.
 */
export const meetingsRouter = createTRPCRouter({
  /** A Dossier's Réunions, newest first; notes and recordings for the consultant only. */
  forDossier: protectedProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    const consultant = isConsultant(ctx.session);
    // Enregistrements are the consultant's: fetched from Stream when its webhook didn't bring them.
    if (consultant) await syncMeetingFiles(ctx.prisma);
    const meetings = await ctx.prisma.meeting.findMany({
      where: { dossierId: dossier.id },
      orderBy: { startsAt: 'desc' },
      select: { ...shown, ...consultantOnly },
    });
    return {
      open: dossier.state === 'OPEN',
      configured: streamConfigured(),
      // The Client never sees the link, notes, Enregistrements or Transcriptions.
      meetings: consultant
        ? meetings
        : meetings.map((meeting) => ({ ...meeting, inviteToken: null, notes: null, recordings: [] })),
    };
  }),

  /** One Réunion for its room: whether it can be joined, and whether the viewer already accepted the recording. */
  room: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
    const consultant = isConsultant(ctx.session);
    if (consultant) await syncMeetingFiles(ctx.prisma);
    const meeting = await meetingFor(ctx.prisma, ctx.session, input.id);
    const [consent, extra] = await Promise.all([
      ctx.prisma.meetingConsent.findUnique({
        where: { meetingId_accountId: { meetingId: meeting.id, accountId: ctx.session.account.id } },
        select: { acceptedAt: true },
      }),
      consultant
        ? ctx.prisma.meeting.findUnique({ where: { id: meeting.id }, select: consultantOnly })
        : Promise.resolve(null),
    ]);
    const now = new Date();
    const dossierOpen = !meeting.dossier || meeting.dossier.state === 'OPEN';
    return {
      ...meeting,
      dossier: undefined,
      consultant: extra,
      joinable: meeting.status === 'SCHEDULED' && dossierOpen && isJoinable(meeting, now),
      past: isPast(meeting, now),
      consentedAt: consent?.acceptedAt ?? null,
      configured: streamConfigured(),
    };
  }),

  /** The consultant plans a Réunion, from a Dossier or on its own; those invited are told by email and bell. */
  schedule: consultantProcedure.input(scheduleInput).mutation(async ({ ctx, input }) => {
    const dossier = input.dossierId ? await dossierFor(ctx.prisma, ctx.session, input.dossierId) : null;
    if (dossier) writable(dossier);
    if (input.startsAt.getTime() < Date.now() - GRACE_MS) throw refuse('MEETING_IN_PAST');
    const invited = await invitees(ctx.prisma, input.participantIds, dossier?.accountId ?? null);
    const meeting = await ctx.prisma.meeting.create({
      data: {
        dossierId: dossier?.id ?? null,
        subject: input.subject,
        description: input.description || null,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        recording: input.recording,
        inviteToken: newInviteToken(),
        plannedById: ctx.session.account.id,
        participants: { create: invited.map((accountId) => ({ accountId })) },
      },
      select: { ...shown, inviteToken: true },
    });
    tell(ctx.prisma, ctx.session.account.id, meeting, people(meeting), 'scheduled');
    return { id: meeting.id, inviteToken: meeting.inviteToken };
  }),

  /** « Réunion instantanée »: it starts now; those invited are told at once. */
  instant: consultantProcedure.input(instantInput).mutation(async ({ ctx, input }) => {
    const dossier = input.dossierId ? await dossierFor(ctx.prisma, ctx.session, input.dossierId) : null;
    if (dossier) writable(dossier);
    const invited = await invitees(ctx.prisma, input.participantIds, dossier?.accountId ?? null);
    const meeting = await ctx.prisma.meeting.create({
      data: {
        kind: 'INSTANT',
        dossierId: dossier?.id ?? null,
        subject: input.subject || `Réunion · ${new Date().toISOString().slice(0, 10)}`,
        startsAt: new Date(),
        durationMinutes: INSTANT_MINUTES,
        recording: input.recording,
        inviteToken: newInviteToken(),
        plannedById: ctx.session.account.id,
        participants: { create: invited.map((accountId) => ({ accountId })) },
      },
      select: { ...shown, inviteToken: true },
    });
    tell(ctx.prisma, ctx.session.account.id, meeting, people(meeting), 'instant');
    return { id: meeting.id, inviteToken: meeting.inviteToken };
  }),

  /**
   * Moves, renames or lengthens a planned Réunion, switches its recording,
   * or changes who is invited. A new moment tells everyone again and resets
   * the reminders; someone newly invited gets the invitation.
   */
  update: consultantProcedure.input(updateMeetingInput).mutation(async ({ ctx, input }) => {
    const meeting = await meetingFor(ctx.prisma, ctx.session, input.id);
    if (meeting.dossier && meeting.dossier.state !== 'OPEN') throw refuse('DOSSIER_CLOSED');
    if (meeting.status !== 'SCHEDULED' || meeting.endedAt) throw refuse('MEETING_NOT_SCHEDULED');
    const moved =
      input.startsAt.getTime() !== meeting.startsAt.getTime() || input.durationMinutes !== meeting.durationMinutes;
    if (moved && input.startsAt.getTime() < Date.now() - GRACE_MS) throw refuse('MEETING_IN_PAST');
    const dossierAccount = meeting.dossierId
      ? (await ctx.prisma.dossier.findUnique({ where: { id: meeting.dossierId }, select: { accountId: true } }))
          ?.accountId ?? null
      : null;
    const invited = await invitees(ctx.prisma, input.participantIds, dossierAccount);
    const before = new Set(meeting.participants.map(({ account }) => account.id));

    const updated = await ctx.prisma.$transaction(async (tx) => {
      await tx.meetingParticipant.deleteMany({ where: { meetingId: meeting.id, accountId: { notIn: invited } } });
      await tx.meetingParticipant.createMany({
        data: invited.filter((id) => !before.has(id)).map((accountId) => ({ meetingId: meeting.id, accountId })),
        skipDuplicates: true,
      });
      return tx.meeting.update({
        where: { id: meeting.id },
        data: {
          subject: input.subject,
          description: input.description || null,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes,
          recording: input.recording,
          ...(moved ? { remindedDayBefore: null, remindedSoon: null } : {}),
        },
        select: shown,
      });
    });
    const everyone = people(updated);
    const added = everyone.filter(({ id }) => !before.has(id));
    tell(ctx.prisma, ctx.session.account.id, updated, added, 'scheduled');
    if (moved) tell(ctx.prisma, ctx.session.account.id, updated, everyone.filter(({ id }) => before.has(id)), 'moved');
  }),

  /** Cancels a Réunion, with an optional reason; those invited are told. */
  cancel: consultantProcedure.input(cancelMeetingInput).mutation(async ({ ctx, input }) => {
    const meeting = await meetingFor(ctx.prisma, ctx.session, input.id);
    const { count } = await ctx.prisma.meeting.updateMany({
      where: { id: meeting.id, status: 'SCHEDULED', kind: { not: 'PERSONAL' } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: input.reason || null },
    });
    if (count === 0) throw refuse('MEETING_NOT_SCHEDULED');
    tell(ctx.prisma, ctx.session.account.id, meeting, people(meeting), 'cancelled', input.reason || null);
  }),

  /** The consultant's private notes on a Réunion. */
  saveNotes: consultantProcedure.input(notesInput).mutation(async ({ ctx, input }) => {
    const meeting = await meetingFor(ctx.prisma, ctx.session, input.id);
    await ctx.prisma.meeting.update({ where: { id: meeting.id }, data: { notes: input.notes.trim() || null } });
  }),

  /**
   * Lets someone invited (or the consultant) into the room while it is
   * open: a recorded Réunion needs their acceptance first, saved with the
   * time. Returns what the browser needs to join this call, and no other.
   */
  join: protectedProcedure.input(joinInput).mutation(async ({ ctx, input }) => {
    const meeting = await meetingFor(ctx.prisma, ctx.session, input.id);
    if (meeting.dossier && meeting.dossier.state !== 'OPEN') throw refuse('DOSSIER_CLOSED');
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
    const invited = people(meeting);
    const room = await openRoom({
      meeting,
      people: [
        ...invited.map(({ id, name }) => ({ id, name, consultant: false })),
        ...consultants.map((consultant) => ({ ...consultant, consultant: true })),
      ],
      viewer: { id: account.id, name: account.name, consultant: isConsultant(ctx.session) },
      language: toLocale(invited[0]?.locale ?? account.locale),
    });
    return { ...room, user: { id: account.id, name: account.name } };
  }),

  /**
   * « Terminer pour tous »: Stream closes the call for everyone. A planned or
   * instant Réunion is then over; the Salle personnelle stays, for next time.
   */
  end: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const meeting = await meetingFor(ctx.prisma, ctx.session, input.id);
    if (meeting.kind !== 'PERSONAL') {
      await ctx.prisma.meeting.update({ where: { id: meeting.id }, data: { endedAt: new Date() } });
    }
    if (streamConfigured()) await endRoom(meeting.id).catch((error) => console.error('[meetings] could not end', error));
  }),

  invitation: createTRPCRouter({
    /** What the invitation link opens on: the Réunion, and where the viewer stands with it. */
    get: protectedProcedure.input(tokenInput).query(async ({ ctx, input }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { inviteToken: input.token },
        select: {
          id: true,
          kind: true,
          subject: true,
          startsAt: true,
          durationMinutes: true,
          status: true,
          endedAt: true,
          participants: { where: { accountId: ctx.session.account.id }, select: { id: true } },
          joinRequests: { where: { accountId: ctx.session.account.id }, select: { status: true } },
        },
      });
      if (!meeting) throw notFound();
      const { participants, joinRequests, ...summary } = meeting;
      const viewer = isConsultant(ctx.session)
        ? 'consultant'
        : participants.length > 0
          ? 'invited'
          : (joinRequests[0]?.status ?? 'NONE');
      return { ...summary, past: isPast(meeting, new Date()), viewer };
    }),

    /** Someone with the link but not invited asks to join; the consultant is told and lets them in, or not. */
    request: protectedProcedure.input(tokenInput).mutation(async ({ ctx, input }) => {
      const meeting = await ctx.prisma.meeting.findUnique({
        where: { inviteToken: input.token },
        select: { id: true, subject: true, status: true, dossierId: true },
      });
      if (!meeting || meeting.status !== 'SCHEDULED') throw notFound();
      if (isConsultant(ctx.session)) return { status: 'ADMITTED' as const };
      const invited = await ctx.prisma.meetingParticipant.findUnique({
        where: { meetingId_accountId: { meetingId: meeting.id, accountId: ctx.session.account.id } },
        select: { id: true },
      });
      if (invited) return { status: 'ADMITTED' as const };
      const existing = await ctx.prisma.meetingJoinRequest.findUnique({
        where: { meetingId_accountId: { meetingId: meeting.id, accountId: ctx.session.account.id } },
        select: { status: true },
      });
      if (existing) return { status: existing.status };
      await ctx.prisma.meetingJoinRequest.create({
        data: { meetingId: meeting.id, accountId: ctx.session.account.id },
      });
      notifyLater(ctx.prisma, {
        kind: 'MEETING_JOIN_REQUEST',
        actorId: ctx.session.account.id,
        recipients: 'CONSULTANTS',
        target: meeting.dossierId ? { dossierId: meeting.dossierId } : {},
        params: { meetingId: meeting.id, subject: meeting.subject, client: ctx.session.account.name },
      });
      return { status: 'PENDING' as const };
    }),

    /** Those waiting to be let in, for the consultant in the room. */
    waiting: consultantProcedure.input(byId).query(({ ctx, input }) =>
      ctx.prisma.meetingJoinRequest.findMany({
        where: { meetingId: input.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, account: { select: { id: true, name: true, email: true, role: true } } },
      }),
    ),

    /** Lets someone in (they become a participant) or refuses them. */
    decide: consultantProcedure.input(decideRequestInput).mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.meetingJoinRequest.findUnique({
        where: { id: input.id },
        select: { id: true, meetingId: true, accountId: true, status: true },
      });
      if (!request || request.status !== 'PENDING') throw refuse('MEETING_REQUEST_DECIDED');
      await ctx.prisma.$transaction(async (tx) => {
        await tx.meetingJoinRequest.update({
          where: { id: request.id },
          data: { status: input.admit ? 'ADMITTED' : 'REFUSED', decidedAt: new Date() },
        });
        if (input.admit) {
          await tx.meetingParticipant.createMany({
            data: [{ meetingId: request.meetingId, accountId: request.accountId }],
            skipDuplicates: true,
          });
        }
      });
    }),
  }),

  dashboard: createTRPCRouter({
    /** The Réunions section's home: today's Réunions and the next one. */
    today: consultantProcedure.query(async ({ ctx }) => {
      const now = new Date();
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      const meetings = await ctx.prisma.meeting.findMany({
        where: {
          kind: { not: 'PERSONAL' },
          status: 'SCHEDULED',
          endedAt: null,
          startsAt: { gte: new Date(start.getTime() - 24 * 60 * 60 * 1000), lt: new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { startsAt: 'asc' },
        select: { ...shown, ...consultantOnly },
      });
      const coming = meetings.filter((meeting) => !isPast(meeting, now));
      const next = await ctx.prisma.meeting.findFirst({
        where: { kind: { not: 'PERSONAL' }, status: 'SCHEDULED', endedAt: null, startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, subject: true, startsAt: true },
      });
      return { meetings: coming, next };
    }),

    /** Every Réunion still to come, or every one over (ended, past or cancelled), the nearest first. */
    list: consultantProcedure.input(meetingListInput).query(async ({ ctx, input }) => {
      const now = new Date();
      if (input.list === 'past') await syncMeetingFiles(ctx.prisma, now);
      const meetings = await ctx.prisma.meeting.findMany({
        where: { kind: { not: 'PERSONAL' } },
        orderBy: { startsAt: input.list === 'upcoming' ? 'asc' : 'desc' },
        select: { ...shown, ...consultantOnly },
      });
      return meetings.filter((meeting) => {
        const over = meeting.status !== 'SCHEDULED' || isPast(meeting, now);
        return input.list === 'upcoming' ? !over : over;
      });
    }),

    /** Every Enregistrement, newest first, with its Réunion and whether a Transcription came with it. */
    recordings: consultantProcedure.query(async ({ ctx }) => {
      await syncMeetingFiles(ctx.prisma);
      const rows = await ctx.prisma.meetingRecording.findMany({
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          kind: true,
          startedAt: true,
          endedAt: true,
          meeting: { select: { id: true, subject: true, kind: true, dossierId: true } },
        },
      });
      const transcribed = new Set(rows.filter((row) => row.kind === 'TRANSCRIPTION').map((row) => row.meeting.id));
      return rows
        .filter((row) => row.kind === 'RECORDING')
        .map((row) => ({ ...row, transcribed: transcribed.has(row.meeting.id) }));
    }),

    /** The consultant's Salle personnelle: always open, its link to share; made the first time. */
    personalRoom: consultantProcedure.query(async ({ ctx }) => {
      const select = { ...shown, ...consultantOnly } as const;
      const existing = await ctx.prisma.meeting.findFirst({
        where: { kind: 'PERSONAL', plannedById: ctx.session.account.id },
        select,
      });
      if (existing) return existing;
      return ctx.prisma.meeting.create({
        data: {
          kind: 'PERSONAL',
          subject: `Salle personnelle · ${ctx.session.account.name}`,
          startsAt: new Date(),
          durationMinutes: INSTANT_MINUTES,
          recording: true,
          inviteToken: newInviteToken(),
          plannedById: ctx.session.account.id,
        },
        select,
      });
    }),

    /** Renames the Salle personnelle, switches its recording, or gives it a new link (the old one stops working). */
    updatePersonalRoom: consultantProcedure
      .input(z.object({ subject: z.string().trim().min(2).max(120), recording: z.boolean(), newLink: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { count } = await ctx.prisma.meeting.updateMany({
          where: { kind: 'PERSONAL', plannedById: ctx.session.account.id },
          data: {
            subject: input.subject,
            recording: input.recording,
            ...(input.newLink ? { inviteToken: newInviteToken() } : {}),
          },
        });
        if (count === 0) throw notFound();
      }),

    /** Clients and partners to invite, by name or email. */
    people: consultantProcedure.input(peopleSearchInput).query(({ ctx, input }) =>
      ctx.prisma.account.findMany({
        where: {
          role: { in: ['MEMBER', 'PARTNER'] },
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { email: { contains: input.query, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 8,
        select: { id: true, name: true, email: true, role: true },
      }),
    ),
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

