// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import type { ConsultationSlots } from '@/features/consultation/server/consultation-router';
import { ReservationView } from '@/features/consultation/views/reservation-view';
import { createTestTRPC, type Handlers } from '@/trpc/__tests__/test-utils';

/** Seam: the booking page, its slot in the address, the visitor signed out unless a test signs them in. */
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }));
const session = vi.hoisted(() => ({ account: null as null | { name: string; email: string; isConsultant: boolean } }));
vi.mock('@/features/auth/hooks/use-current-account', () => ({
  useCurrentAccount: () => ({ account: session.account, pending: false, signOut: vi.fn() }),
}));
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string | { pathname: string; query?: Record<string, string> }; children: ReactNode }) => (
    <a href={typeof href === 'string' ? `/fr${href}` : `/fr${href.pathname}?${new URLSearchParams(href.query)}`} {...props}>
      {children}
    </a>
  ),
  useRouter: () => router,
}));

const START = '2026-11-24T08:00:00.000Z'; // mardi 24 novembre, 09:00 Douala
const SLOTS: ConsultationSlots = {
  durationMinutes: 45,
  moveCutoffHours: 24,
  price: 12_345,
  days: [{ day: '2026-11-24', starts: [START, '2026-11-24T10:00:00.000Z'] }],
};

const held = (extra: Record<string, unknown> = {}) => ({
  id: 'con_1',
  status: 'HELD',
  held: true,
  startsAt: new Date(START),
  durationMinutes: 45,
  heldUntil: new Date(Date.now() + 14 * 60_000),
  price: 12_345,
  contact: { name: 'Aminata Diallo', email: 'aminata@example.com', country: 'CM', phone: '+237677123456', whatsappReminders: true },
  answers: { topics: [], crsScore: null, itaReceived: null, situation: null },
  ...extra,
});

function renderPage(handlers: Handlers = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'consultation.slots': () => SLOTS, ...handlers });
  queryClient.setQueryData(trpc.consultation.slots.queryKey(), SLOTS);
  return render(withIntl(wrap(<ReservationView />)));
}

const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  session.account = null;
  search.params = new URLSearchParams({ creneau: START });
});
afterEach(() => window.sessionStorage.clear());

describe('ReservationView, step 1 signed out', () => {
  it('holds the slot with their details, then opens « Préparer l’échange »', async () => {
    const book = vi.fn(() => ({ id: 'con_1', heldUntil: new Date(Date.now() + 15 * 60_000), token: 'secret-'.padEnd(43, 'x') }));
    renderPage({ 'consultation.book': book, 'consultation.booking': () => held() });

    fill(/^Prénom$/, 'Aminata');
    fill(/^Nom$/, 'Diallo');
    fill(/^E-mail$/, 'aminata@example.com');
    fill(/Numéro WhatsApp/, '6 77 12 34 56');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() => expect(book).toHaveBeenCalled());
    expect(book).toHaveBeenCalledWith(
      expect.objectContaining({
        start: START,
        contact: expect.objectContaining({ name: 'Aminata Diallo', email: 'aminata@example.com', country: 'CM', whatsappReminders: true }),
      }),
    );
    expect(await screen.findByText('De quoi voulez-vous parler ?')).toBeInTheDocument();
    // The secret stays in this tab, never in the address.
    expect(window.sessionStorage.getItem('stanzy.consultation.booking')).toContain('secret-');
    expect(await screen.findByText('Créneau gardé 15 minutes')).toBeInTheDocument();
  });

  it('says under the field when the number is not a real one, and sends nothing', () => {
    const book = vi.fn();
    renderPage({ 'consultation.book': book });
    fill(/^Prénom$/, 'Aminata');
    fill(/^Nom$/, 'Diallo');
    fill(/^E-mail$/, 'aminata@example.com');
    fill(/Numéro WhatsApp/, '12');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ce numéro ne semble pas valide pour ce pays.');
    expect(book).not.toHaveBeenCalled();
  });

  it('asks to sign in when the e-mail already has a Compte, coming back to this slot', async () => {
    renderPage({
      'consultation.book': () => {
        throw new Error('ACCOUNT_EXISTS');
      },
    });
    fill(/^Prénom$/, 'Aminata');
    fill(/^Nom$/, 'Diallo');
    fill(/^E-mail$/, 'aminata@example.com');
    fill(/Numéro WhatsApp/, '677123456');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const alert = await screen.findByText(/Un Compte existe déjà avec cet e-mail/);
    const signIn = within(alert.closest('[role="alert"]')!).getByRole('link', { name: 'Se connecter' });
    const next = new URL(signIn.getAttribute('href')!, 'https://x').searchParams.get('next')!;
    expect(new URL(next, 'https://x').searchParams.get('creneau')).toBe(START);
    expect(next.startsWith('/services/consultation/reserver?')).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPage();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ReservationView, a held booking', () => {
  beforeEach(() => window.sessionStorage.setItem('stanzy.consultation.booking', JSON.stringify({ id: 'con_1', token: 'x'.repeat(43) })));

  it('saves what they prepared, then opens Paiement', async () => {
    const prepare = vi.fn(() => ({ id: 'con_1' }));
    renderPage({ 'consultation.booking': () => held(), 'consultation.prepare': prepare });

    fireEvent.click(await screen.findByRole('button', { name: /Mon admissibilité/ }));
    fill(/Score CRS/, '452');
    fireEvent.click(screen.getByRole('button', { name: /Continuer vers le paiement/ }));

    await waitFor(() =>
      expect(prepare).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'con_1', answers: expect.objectContaining({ topics: ['eligibility'], crsScore: 452 }) }),
      ),
    );
    expect(await screen.findByText(/Le paiement en ligne/)).toBeInTheDocument();
  });

  it('offers the next free slots once it was released, and holds one again for the same Compte', async () => {
    const book = vi.fn(() => ({ id: 'con_2', heldUntil: new Date(Date.now() + 15 * 60_000), token: 'y'.repeat(43) }));
    renderPage({ 'consultation.booking': () => held({ held: false, heldUntil: new Date(Date.now() - 1000) }), 'consultation.book': book });

    expect(await screen.findByRole('heading', { name: 'Votre créneau a été libéré' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Garder .* et payer/ }));

    await waitFor(() =>
      expect(book).toHaveBeenCalledWith(expect.objectContaining({ start: START, previous: { id: 'con_1', token: 'x'.repeat(43) } })),
    );
  });
});

describe('ReservationView, no slot', () => {
  it('sends back to the slots when nothing is chosen nor held', () => {
    search.params = new URLSearchParams();
    renderPage();
    expect(screen.getByRole('link', { name: 'Voir les créneaux' })).toHaveAttribute('href', '/fr/services/consultation');
  });
});
