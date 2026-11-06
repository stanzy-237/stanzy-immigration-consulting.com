// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierMeetingsView } from '@/features/meetings/views/dossier-meetings-view';
import { InvitationView } from '@/features/meetings/views/invitation-view';
import { MeetingRoomView } from '@/features/meetings/views/meeting-room-view';
import { MeetingsHomeView } from '@/features/meetings/views/meetings-home-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Réunion screens with their data in the cache; Stream's call is stubbed. */
vi.mock('@/features/meetings/components/meeting-call', () => ({
  MeetingCall: ({ access }: { access: { callId: string } }) => <p>call {access.callId}</p>,
}));
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date('2026-11-11T12:50:00Z'), toFake: ['Date'] });
});
afterEach(() => vi.useRealTimers());

const meeting = (extra: Record<string, unknown> = {}) => ({
  id: 'm_1',
  kind: 'SCHEDULED',
  dossierId: 'dos_1',
  description: null,
  endedAt: null,
  inviteToken: null,
  participants: [{ account: { id: 'acc_1', name: 'Aminata Diallo', email: 'a@x.com', locale: 'fr', role: 'MEMBER' } }],
  subject: 'Point sur la preuve de fonds',
  startsAt: new Date('2026-11-11T13:00:00Z'),
  durationMinutes: 30,
  recording: true,
  status: 'SCHEDULED',
  cancelReason: null,
  notes: null,
  recordings: [],
  ...extra,
});

function panel(viewer: 'client' | 'consultant', meetings: unknown[], handlers: Record<string, (input: never) => unknown> = {}) {
  const data = { open: true, configured: true, meetings };
  const { trpc, queryClient, wrap } = createTestTRPC({ 'meetings.forDossier': () => data, ...handlers });
  queryClient.setQueryData(trpc.meetings.forDossier.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierMeetingsView dossierId="dos_1" viewer={viewer} />)));
}

describe('the Réunions panel', () => {
  it('lets the Client join once the room is open, without the consultant’s controls', async () => {
    const { container } = panel('client', [meeting(), meeting({ id: 'm_2', subject: 'Plus tard', startsAt: new Date('2026-11-20T13:00:00Z') })]);
    expect(screen.getByRole('link', { name: 'Rejoindre « Point sur la preuve de fonds »' })).toHaveAttribute(
      'href',
      '/fr/mon-espace/reunions/m_1',
    );
    expect(screen.getByText('La salle ouvre 15 minutes avant.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Planifier une réunion' })).not.toBeInTheDocument();
    expect(screen.queryByText('Notes (pour vous seul)')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('lets the consultant plan one, recorded by default', async () => {
    const schedule = vi.fn();
    panel('consultant', [], { 'meetings.schedule': (input) => schedule(input) ?? { id: 'm_9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Planifier une réunion' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Objet'), { target: { value: 'Point EDE' } });
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-11-12' } });
    fireEvent.change(within(dialog).getByLabelText('Heure'), { target: { value: '10:00' } });
    fireEvent.change(within(dialog).getByLabelText('Durée'), { target: { value: '45' } });
    expect(within(dialog).getByLabelText(/Enregistrer et transcrire/)).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Planifier' }));
    await waitFor(() =>
      expect(schedule).toHaveBeenCalledWith({
        dossierId: 'dos_1',
        subject: 'Point EDE',
        description: null,
        startsAt: new Date('2026-11-12T10:00'),
        durationMinutes: 45,
        recording: true,
        participantIds: [],
      }),
    );
  });

  it('shows the consultant a past Réunion’s Enregistrement and Transcription', () => {
    panel('consultant', [
      meeting({
        startsAt: new Date('2026-11-01T13:00:00Z'),
        recordings: [
          { id: 'r_1', kind: 'RECORDING', startedAt: new Date('2026-11-01T13:00:00Z'), endedAt: new Date(), text: null },
          { id: 'r_2', kind: 'TRANSCRIPTION', startedAt: new Date(), endedAt: new Date(), text: 'Stanzy : Bonjour.' },
        ],
      }),
    ]);
    expect(screen.getByRole('link', { name: /Enregistrement du/ })).toHaveAttribute('href', '/api/meetings/recordings/r_1');
    // Played on the page itself.
    expect(document.querySelector('video')).toHaveAttribute('src', '/api/meetings/recordings/r_1');
    fireEvent.click(screen.getByRole('button', { name: 'Lire la transcription' }));
    expect(screen.getByText('Stanzy : Bonjour.')).toBeInTheDocument();
    expect(screen.getByLabelText('Chercher dans les transcriptions')).toBeInTheDocument();
  });
});

describe('the room', () => {
  const room = (extra: Record<string, unknown> = {}) => ({
    ...meeting(),
    plannedById: 'acc_stanzy',
    consultant: null,
    joinable: true,
    past: false,
    consentedAt: null,
    configured: true,
    ...extra,
  });
  function open(data: unknown, handlers: Record<string, (input: never) => unknown> = {}) {
    const { trpc, queryClient, wrap } = createTestTRPC({ 'meetings.room': () => data, ...handlers });
    queryClient.setQueryData(trpc.meetings.room.queryKey({ id: 'm_1' }), data as never);
    return render(withIntl(wrap(<MeetingRoomView meetingId="m_1" viewer="client" />)));
  }

  it('asks to accept the recording before joining', async () => {
    const join = vi.fn();
    const { container } = open(room(), {
      'meetings.join': (input) => join(input) ?? { apiKey: 'k', token: 't', callId: 'meeting_m_1', user: { id: 'acc_1', name: 'A' } },
    });
    expect(screen.getByRole('heading', { name: 'Cette réunion est enregistrée' })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Rejoindre' });
    expect(button).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByLabelText('J’accepte que la réunion soit enregistrée'));
    fireEvent.click(button);
    await waitFor(() => expect(join).toHaveBeenCalledWith({ id: 'm_1', accepted: true }));
    expect(await screen.findByText('call meeting_m_1')).toBeInTheDocument();
  });

  it('says when the room isn’t open, or the Réunion was cancelled', () => {
    const { unmount } = open(room({ joinable: false }));
    expect(screen.getByText('La salle ouvre 15 minutes avant le début.')).toBeInTheDocument();
    unmount();
    open(room({ status: 'CANCELLED', joinable: false }));
    expect(screen.getByText('Cette réunion a été annulée.')).toBeInTheDocument();
  });
});

describe('the Réunions section', () => {
  const hubMeeting = (extra: Record<string, unknown> = {}) => ({
    ...meeting(),
    startsAt: new Date('2026-11-11T13:10:00Z'),
    inviteToken: 'abcdefghijklmnopqrstuvwxyz012345',
    notes: null,
    plannedById: 'acc_stanzy',
    dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT', account: { name: 'Aminata Diallo' } },
    ...extra,
  });

  it('shows the time, the next Réunion and today’s, with « Démarrer » and « Copier l’invitation »', async () => {
    const data = { meetings: [hubMeeting()], next: { id: 'm_1', subject: 'Point sur la preuve de fonds', startsAt: new Date('2026-11-11T13:10:00Z') } };
    const { trpc, queryClient, wrap } = createTestTRPC({ 'meetings.dashboard.today': () => data });
    queryClient.setQueryData(trpc.meetings.dashboard.today.queryKey(), data as never);
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const { container } = render(withIntl(wrap(<MeetingsHomeView />)));

    expect(screen.getByText(/Prochaine réunion à .* · Point sur la preuve de fonds/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouvelle réunion/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Démarrer « Point sur la preuve de fonds »' })).toHaveAttribute('href', '/reunions/m_1');
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Copier l’invitation de « Point sur la preuve de fonds »' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/fr/reunion/abcdefghijklmnopqrstuvwxyz012345')));
  });

  it('lets someone with the link ask to enter, then wait', async () => {
    let viewer = 'NONE';
    const request = vi.fn();
    const invitation = () => ({
      id: 'm_1',
      kind: 'INSTANT',
      subject: 'Point rapide',
      startsAt: new Date('2026-11-11T12:50:00Z'),
      durationMinutes: 60,
      status: 'SCHEDULED',
      endedAt: null,
      past: false,
      viewer,
    });
    const { trpc, queryClient, wrap } = createTestTRPC({
      'meetings.invitation.get': () => invitation(),
      'meetings.invitation.request': (input) => {
        request(input);
        viewer = 'PENDING';
        return { status: 'PENDING' };
      },
    });
    queryClient.setQueryData(trpc.meetings.invitation.get.queryKey({ token: 'abcdefghijklmnopqrstuvwxyz012345' }), invitation() as never);
    render(withIntl(wrap(<InvitationView token="abcdefghijklmnopqrstuvwxyz012345" />)));

    fireEvent.click(screen.getByRole('button', { name: 'Demander à entrer' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ token: 'abcdefghijklmnopqrstuvwxyz012345' }));
    expect(await screen.findByText(/Votre demande est envoyée/)).toBeInTheDocument();
  });
});
