'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CalendarCheck2, Copy, Play, Video, X } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useDeferredValue, useId, useState, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { siteOriginOf } from '@/features/dashboard/lib/dashboard-host';
import { consultantRoomPath, invitationPath, PARTICIPANTS_MAX, peopleSearchInput } from '@/features/meetings/lib/meeting-schema';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

export type HubMeeting = RouterOutputs['meetings']['dashboard']['list'][number];
export type InvitedPerson = { id: string; name: string; email: string; role: string };

export const MEETING_PAGES = [
  { key: 'home', href: '/reunions' },
  { key: 'upcoming', href: '/reunions/a-venir' },
  { key: 'past', href: '/reunions/passees' },
  { key: 'recordings', href: '/reunions/enregistrements' },
  { key: 'personal', href: '/reunions/salle-personnelle' },
] as const;
export type MeetingPage = (typeof MEETING_PAGES)[number]['key'];

/** The Réunions section's own pages, under its title. */
export function MeetingsNav({ page, title }: { page: MeetingPage; title: string }): ReactNode {
  const t = useTranslations('Meetings.hub.nav');
  return (
    <div className="grid grid-cols-1 gap-4">
      <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{title}</h1>
      <nav aria-label={t('label')} className="flex gap-1 overflow-x-auto border-b border-fog-light">
        {MEETING_PAGES.map((entry) => (
          <Link
            key={entry.key}
            href={entry.href}
            aria-current={entry.key === page ? 'page' : undefined}
            className={
              entry.key === page
                ? '-mb-px border-b-2 border-rouge px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-navy-deep'
                : '-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-slate hover:text-navy-deep'
            }
          >
            {t(entry.key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** Who is invited, as overlapping initials: four at most, then « +N ». */
export function Avatars({ people }: { people: { id: string; name: string }[] }): ReactNode {
  const t = useTranslations('Meetings.hub.card');
  if (people.length === 0) return <span className="text-xs text-slate">{t('nobody')}</span>;
  const shown = people.slice(0, 4);
  const more = people.length - shown.length;
  return (
    <ul className="flex -space-x-2" aria-label={people.map((person) => person.name).join(', ')}>
      {shown.map((person) => (
        <li
          key={person.id}
          title={person.name}
          aria-hidden={true}
          className="grid size-9 place-items-center rounded-full border-2 border-white bg-ice-blue text-xs font-bold text-navy-deep"
        >
          {initials(person.name)}
        </li>
      ))}
      {more > 0 ? (
        <li
          aria-hidden={true}
          className="grid size-9 place-items-center rounded-full border-2 border-white bg-navy-deep text-xs font-bold text-white"
        >
          +{more}
        </li>
      ) : null}
    </ul>
  );
}

/** The invitation as a sentence with its link, on the public site (not admin.<site>), copied for pasting anywhere. */
export function useCopyInvitation(): (meeting: { subject: string; startsAt: Date; inviteToken: string | null; kind?: string }) => void {
  const t = useTranslations('Meetings.hub.card');
  const format = useFormatter();
  const locale = useLocale();
  return (meeting) => {
    if (!meeting.inviteToken) return;
    const link = `${siteOriginOf(window.location.origin)}/${locale}${invitationPath(meeting.inviteToken)}`;
    const when =
      meeting.kind === 'PERSONAL'
        ? ''
        : format.dateTime(meeting.startsAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const text = when ? t('invitation', { subject: meeting.subject, when, link }) : `${meeting.subject} : ${link}`;
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.add({ title: t('copied'), type: 'success' }))
      .catch(() => window.prompt(t('copy'), link));
  };
}

/** One Réunion as a card: what, when, who, and « Démarrer » / « Copier l'invitation » while it is to come. */
export function MeetingCard({ meeting, upcoming }: { meeting: HubMeeting; upcoming: boolean }): ReactNode {
  const t = useTranslations('Meetings.hub.card');
  const format = useFormatter();
  const copy = useCopyInvitation();
  const end = new Date(meeting.startsAt.getTime() + meeting.durationMinutes * 60_000);
  const day = format.dateTime(meeting.startsAt, { weekday: 'long', day: 'numeric', month: 'long' });
  const from = format.dateTime(meeting.startsAt, { hour: '2-digit', minute: '2-digit' });
  const to = format.dateTime(end, { hour: '2-digit', minute: '2-digit' });
  const people = meeting.participants.map(({ account }) => account);
  const files = meeting.recordings.filter((file) => file.kind === 'RECORDING').length;
  const Icon = upcoming ? CalendarClock : CalendarCheck2;

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Icon aria-hidden={true} className="size-6 text-navy-deep" />
        <span className="flex flex-wrap justify-end gap-1">
          {meeting.kind === 'INSTANT' ? (
            <span className="rounded-full bg-ice-blue px-2 py-0.5 text-xs font-semibold text-navy-deep">{t('instant')}</span>
          ) : null}
          {meeting.status === 'CANCELLED' ? (
            <span className="rounded-full bg-fog-light px-2 py-0.5 text-xs font-semibold text-slate">{t('cancelled')}</span>
          ) : meeting.endedAt ? (
            <span className="rounded-full bg-fog-light px-2 py-0.5 text-xs font-semibold text-slate">{t('ended')}</span>
          ) : null}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-heading text-lg font-bold text-navy-deep">{meeting.subject}</h3>
        <p className="text-sm text-slate first-letter:uppercase">
          {day} · {from} – {to}
        </p>
        {meeting.dossier ? (
          <Link href={`/dossiers/${meeting.dossier.id}`} className="text-xs font-semibold text-rouge hover:text-crimson">
            {t('dossier', { name: meeting.dossier.account.name })}
          </Link>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <Avatars people={people} />
        {upcoming ? (
          <span className="flex gap-2">
            <Link
              href={consultantRoomPath(meeting.id)}
              aria-label={t('startLabel', { subject: meeting.subject })}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson"
            >
              <Video aria-hidden={true} className="size-4" />
              {t('start')}
            </Link>
            <button
              type="button"
              onClick={() => copy(meeting)}
              aria-label={t('copyLabel', { subject: meeting.subject })}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-off-white px-4 text-sm font-semibold text-navy-deep hover:bg-fog-light"
            >
              <Copy aria-hidden={true} className="size-4" />
              {t('copy')}
            </button>
          </span>
        ) : files > 0 ? (
          <Link
            href={consultantRoomPath(meeting.id)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-off-white px-4 text-sm font-semibold text-navy-deep hover:bg-fog-light"
          >
            <Play aria-hidden={true} className="size-4" />
            {t('recordings', { count: files })}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function MeetingCardsSkeleton(): ReactNode {
  const t = useTranslations('Meetings.hub.list');
  return (
    <div role="status" className="grid gap-4 md:grid-cols-2">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2, 3].map((key) => (
        <Skeleton key={key} aria-hidden={true} className="h-52 rounded-2xl" />
      ))}
    </div>
  );
}

/** Chooses who to invite: Clients and partners, found by name or email, shown as chips to remove. */
export function PeoplePicker({
  value,
  onChange,
}: {
  value: InvitedPerson[];
  onChange: (people: InvitedPerson[]) => void;
}): ReactNode {
  const t = useTranslations('Meetings.hub.people');
  const ids = useId();
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const searchable = peopleSearchInput.safeParse({ query: deferred }).success;
  const { data: matches, isPending } = useQuery({
    ...trpc.meetings.dashboard.people.queryOptions({ query: deferred }),
    enabled: searchable,
  });
  const chosen = new Set(value.map((person) => person.id));
  const full = value.length >= PARTICIPANTS_MAX;

  return (
    <div className="grid grid-cols-1 gap-2">
      <label htmlFor={`${ids}-search`} className="text-sm font-semibold text-navy-deep">
        {t('label')}
      </label>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((person) => (
            <li
              key={person.id}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-ice-blue pr-1 pl-3 text-xs font-semibold text-navy-deep"
            >
              {person.name}
              {person.role === 'PARTNER' ? <span className="text-slate">· {t('partner')}</span> : null}
              <button
                type="button"
                onClick={() => onChange(value.filter((other) => other.id !== person.id))}
                aria-label={t('remove', { name: person.name })}
                className="inline-flex size-6 items-center justify-center rounded-full hover:bg-white"
              >
                <X aria-hidden={true} className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={`${ids}-search`}
        type="search"
        autoComplete="off"
        disabled={full}
        value={query}
        placeholder={t('search')}
        aria-describedby={`${ids}-hint`}
        onChange={(event) => setQuery(event.target.value)}
        className="h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none disabled:opacity-50"
      />
      <p id={`${ids}-hint`} className="text-xs text-slate">
        {t('hint')}
      </p>
      {searchable ? (
        isPending ? (
          <div role="status">
            <span className="sr-only">{t('loading')}</span>
            <Skeleton aria-hidden={true} className="h-11 rounded-xl" />
          </div>
        ) : matches && matches.filter((match) => !chosen.has(match.id)).length > 0 ? (
          <ul className="grid grid-cols-1 gap-1">
            {matches
              .filter((match) => !chosen.has(match.id))
              .map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...value, match]);
                      setQuery('');
                    }}
                    className="flex w-full flex-col rounded-xl border border-fog-light px-3.5 py-2 text-left hover:border-navy-deep"
                  >
                    <span className="text-sm font-semibold text-navy-deep">
                      {match.name}
                      {match.role === 'PARTNER' ? <span className="font-normal text-slate"> · {t('partner')}</span> : null}
                    </span>
                    <span className="text-xs text-slate">{match.email}</span>
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-slate">{t('noMatch')}</p>
        )
      ) : null}
    </div>
  );
}
