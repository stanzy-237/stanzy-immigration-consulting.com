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
  payment: null,
  meetingId: null,
  promo: null,
  amount: 12_345,
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
    renderPage({
      'consultation.booking': () => held(),
      'consultation.prepare': prepare,
      'consultation.paymentOptions': () => ({ open: false, price: 12_345, networks: [], card: null }),
    });

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

const OPTIONS = {
  open: true,
  price: 12_345,
  networks: [{ code: 'mtn_cm', name: 'MTN Mobile Money', otpRequired: false, otpInstructions: '', fee: 587, tiers: [{ minAmount: 0, maxAmount: null, percent: 4.75, fixed: 0, floor: null, cap: null }] }],
  card: { name: 'Carte bancaire', currency: 'USD' },
};

const paymentOf = (extra: Record<string, unknown> = {}) => ({
  id: '0b8f6a3e-4b5d-4c1e-9a2f-5d6e7f8a9b0c',
  status: 'PENDING',
  network: 'mtn_cm',
  networkName: 'MTN Mobile Money',
  phone: '+237677123456',
  amount: 12_345,
  currency: 'XAF',
  discount: 0,
  promoCode: null,
  charged: null,
  fee: null,
  settledCurrency: null,
  checkoutUrl: null,
  createdAt: new Date(),
  settledAt: null,
  consultation: null,
  heldUntil: new Date(Date.now() + 14 * 60_000),
  ...extra,
});

describe('ReservationView, paying', () => {
  beforeEach(() => window.sessionStorage.setItem('stanzy.consultation.booking', JSON.stringify({ id: 'con_1', token: 'x'.repeat(43) })));

  async function toPayment(handlers: Handlers) {
    renderPage({ 'consultation.booking': () => held(), 'consultation.prepare': () => ({ id: 'con_1' }), 'consultation.paymentOptions': () => OPTIONS, ...handlers });
    fireEvent.click(await screen.findByRole('button', { name: /Continuer vers le paiement/ }));
  }

  it('offers SasPay’s networks with their fee, then pushes the payment to their number and waits for their phone', async () => {
    const pay = vi.fn(() => ({ paymentId: paymentOf().id, checkoutUrl: null }));
    await toPayment({ 'consultation.pay': pay, 'consultation.payment': () => paymentOf() });

    expect(await screen.findByText('MTN Mobile Money')).toBeInTheDocument();
    // In the summary (desktop) and above the bottom bar (mobile).
    expect(screen.getAllByText('+587 FCFA').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Payer 12.?932 FCFA/ }));

    await waitFor(() =>
      expect(pay).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'con_1', method: { kind: 'network', country: 'CM', network: 'mtn_cm', phone: expect.stringMatching(/6 ?77/) } }),
      ),
    );
    expect(await screen.findByRole('heading', { name: 'Validez sur votre téléphone' })).toBeInTheDocument();
    expect(screen.getByText('Demande envoyée à MTN Mobile Money')).toBeInTheDocument();
  });

  it('says the payment did not go through, nothing charged, and offers to try again', async () => {
    window.sessionStorage.setItem('stanzy.consultation.booking', JSON.stringify({ id: 'con_1', token: 'x'.repeat(43) }));
    renderPage({
      'consultation.booking': () => held({ payment: { id: paymentOf().id, status: 'PENDING', createdAt: new Date() } }),
      'consultation.payment': () => paymentOf({ status: 'FAILED' }),
    });
    expect(await screen.findByRole('heading', { name: 'Le paiement n’est pas passé' })).toBeInTheDocument();
    expect(screen.getByText('0 FCFA débité')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Changer de moyen de paiement' })).toBeInTheDocument();
  });

  it('confirms only once SasPay said SUCCESS: « C’est réservé », the way to Mon espace and the receipt', async () => {
    renderPage({
      'consultation.booking': () => held({ status: 'PAID', held: false, payment: { id: paymentOf().id, status: 'SUCCESS', createdAt: new Date() } }),
      'consultation.payment': () =>
        paymentOf({
          status: 'SUCCESS',
          fee: 587,
          charged: 12_932,
          settledCurrency: 'XAF',
          settledAt: new Date(),
          consultation: { firstName: 'Aminata', startsAt: new Date(START), durationMinutes: 45, meetingId: 'meet_1' },
        }),
    });
    expect(await screen.findByRole('heading', { name: 'C’est réservé, Aminata.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à Mon espace' })).toHaveAttribute('href', '/fr/mon-espace/reunions/meet_1');
    expect(screen.getByText(/12.?932 FCFA/)).toBeInTheDocument();
  });

  it('where there is no Mobile Money, pays by card on SasPay’s page in a new tab', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const pay = vi.fn(() => ({ paymentId: paymentOf().id, checkoutUrl: 'https://sandbox-checkout.saspay.me/card/x' }));
    await toPayment({
      'consultation.paymentOptions': () => ({ ...OPTIONS, networks: [] }),
      'consultation.pay': pay,
      'consultation.payment': () => paymentOf({ network: 'card', networkName: 'Carte bancaire', phone: null, checkoutUrl: 'https://sandbox-checkout.saspay.me/card/x' }),
    });

    expect(await screen.findByText('Carte bancaire')).toBeInTheDocument();
    expect(screen.getByText(/débitée en USD au taux du jour/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Payer par carte/ }));
    await waitFor(() => expect(pay).toHaveBeenCalledWith(expect.objectContaining({ method: { kind: 'card', country: 'CM' } })));
    expect(open).toHaveBeenCalled();
    await waitFor(() => expect(tab.location.href).toBe('https://sandbox-checkout.saspay.me/card/x'));
    expect(await screen.findByRole('heading', { name: 'Finissez sur la page SasPay' })).toBeInTheDocument();
    open.mockRestore();
  });

  it('lets them pay from any country, and says so when SasPay has nothing there', async () => {
    await toPayment({ 'consultation.paymentOptions': ({ country }: { country: string }) => (country === 'CM' ? OPTIONS : { ...OPTIONS, networks: [], card: null }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Payer depuis un autre pays' }));
    // Every country, not only those with Mobile Money (and never SasPay's « XX »).
    const select = screen.getByRole('combobox', { name: 'Pays du moyen de paiement' });
    expect(within(select).getByRole('option', { name: 'Canada' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'CA' } });
    expect(await screen.findByText(/SasPay ne propose pas de moyen de paiement pour ce pays/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Payer par carte/ })).toBeDisabled();
  });

  it('asks Orange Money CI’s code, with SasPay’s own instructions, before paying', async () => {
    const pay = vi.fn();
    await toPayment({
      'consultation.paymentOptions': () => ({
        ...OPTIONS,
        networks: [{ code: 'orange_ci', name: 'Orange Money', otpRequired: true, otpInstructions: 'Composez #144*82# puis l’option 2.', fee: 470, tiers: null }],
      }),
      'consultation.pay': pay,
    });
    expect(await screen.findByText('Composez #144*82# puis l’option 2.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Payer 12.?815 FCFA/ }));
    expect(await screen.findByText('Saisissez le code de paiement reçu sur votre téléphone.')).toBeInTheDocument();
    expect(pay).not.toHaveBeenCalled();
  });

  it('shows a card’s receipt in the currency SasPay charged it', async () => {
    renderPage({
      'consultation.booking': () => held({ status: 'PAID', held: false, payment: { id: paymentOf().id, status: 'SUCCESS', createdAt: new Date() } }),
      'consultation.payment': () =>
        paymentOf({
          status: 'SUCCESS',
          network: 'card',
          networkName: 'Carte bancaire',
          phone: null,
          fee: 0.35,
          charged: 2.02,
          settledCurrency: 'USD',
          settledAt: new Date(),
          consultation: { firstName: 'Aminata', startsAt: new Date(START), durationMinutes: 45, meetingId: 'meet_1' },
        }),
    });
    expect(await screen.findByText(/2,02.*\$/)).toBeInTheDocument();
    expect(screen.getByText('Débité en USD par SasPay, au taux du jour.')).toBeInTheDocument();
  });
});

describe('ReservationView, a Code promo', () => {
  beforeEach(() => window.sessionStorage.setItem('stanzy.consultation.booking', JSON.stringify({ id: 'con_1', token: 'x'.repeat(43) })));

  const BF = { code: 'BLACKFRIDAY', reductionType: 'PERCENT', reductionValue: 70, discount: 8_642, places: 20, placesLeft: 7, endsAt: new Date('2026-11-27T22:59:00Z') };

  async function toPayment(handlers: Handlers) {
    renderPage({ 'consultation.prepare': () => ({ id: 'con_1' }), 'consultation.paymentOptions': () => OPTIONS, ...handlers });
    fireEvent.click(await screen.findByRole('button', { name: /Continuer vers le paiement/ }));
  }

  it('applies a code: the reduction, the places left, and « Payer » for what is left plus the fee on it', async () => {
    let promo: typeof BF | null = null;
    const applyPromo = vi.fn(() => {
      promo = BF;
      return { code: 'BLACKFRIDAY' };
    });
    await toPayment({ 'consultation.booking': () => held({ promo, amount: promo ? 12_345 - 8_642 : 12_345 }), 'consultation.applyPromo': applyPromo });

    fireEvent.click(await screen.findByRole('button', { name: /Vous avez un code promo/ }));
    fill(/^Code promo$/, 'blackfriday');
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    await waitFor(() => expect(applyPromo).toHaveBeenCalledWith(expect.objectContaining({ id: 'con_1', code: 'BLACKFRIDAY' })));
    expect((await screen.findAllByText(/Plus que 7 places sur 20/)).length).toBeGreaterThan(0);
    // 3 703 FCFA left, MTN's 4,75 % on it: 176 FCFA.
    expect(screen.getByRole('button', { name: /Payer 3.?879 FCFA/ })).toBeInTheDocument();
  });

  it('suggests the code a typo meant', async () => {
    await toPayment({
      'consultation.booking': () => held(),
      'consultation.applyPromo': () => {
        throw new Error('PROMO_UNKNOWN:BLACKFRIDAY');
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Vous avez un code promo/ }));
    fill(/^Code promo$/, 'BLACKFRYDAY');
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce code n’existe pas. Vérifiez l’orthographe : BLACKFRIDAY ?');
  });

  it('« Dernière place partie »: nothing charged, and paying the full price from there', async () => {
    let promo: typeof BF | null = BF;
    const pay = vi.fn(() => {
      if (promo) {
        promo = null;
        throw new Error('PROMO_LAST_PLACE');
      }
      return { paymentId: paymentOf().id, checkoutUrl: null };
    });
    await toPayment({
      'consultation.booking': () => held({ promo, amount: promo ? 12_345 - 8_642 : 12_345 }),
      'consultation.pay': pay,
      'consultation.payment': () => paymentOf(),
    });
    fireEvent.click(await screen.findByRole('button', { name: /Payer 3.?879 FCFA/ }));

    expect(await screen.findByText('Dernière place partie')).toBeInTheDocument();
    expect(screen.getByText(/Rien n’a été débité/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Payer 12.?932 FCFA/ }));
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'Validez sur votre téléphone' })).toBeInTheDocument();
  });
});
