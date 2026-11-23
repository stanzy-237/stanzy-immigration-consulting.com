// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import type { ConsultationSlots } from '@/features/consultation/server/consultation-router';
import { ConsultationView } from '@/features/consultation/views/consultation-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the public Consultation page with its free slots in the cache, as the route prefetches them. */
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
}));

/** `HH:MM` Douala (UTC+1) on `day`, as the ISO start the server sends. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00+01:00`).toISOString();

const SLOTS: ConsultationSlots = {
  durationMinutes: 45,
  moveCutoffHours: 24,
  price: 12_345,
  days: [
    { day: '2026-11-25', starts: [] }, // Wednesday, booked full
    { day: '2026-11-26', starts: [at('2026-11-26', '09:00'), at('2026-11-26', '11:00')] },
    { day: '2026-11-27', starts: [at('2026-11-27', '14:00')] },
  ],
};

function renderPage(slots: ConsultationSlots = SLOTS) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'consultation.slots': () => slots });
  queryClient.setQueryData(trpc.consultation.slots.queryKey(), slots);
  return render(withIntl(wrap(<ConsultationView />)));
}

const panel = () => screen.getByRole('region', { name: 'Choisissez votre créneau' });

describe('ConsultationView, choosing a slot', () => {
  it('opens on the first day with a free slot and books its first time', () => {
    renderPage();
    const booking = panel();
    expect(within(booking).getByText(/45 min en vidéo · Heure de Douala · 12\s345\sFCFA/)).toBeInTheDocument();
    expect(within(booking).getByRole('radio', { name: /jeudi 26 novembre/i })).toBeChecked();
    expect(within(booking).getByRole('radio', { name: '09:00' })).toBeChecked();
    expect(within(booking).getByRole('link', { name: /Réserver jeu\. 26 à 09:00/ })).toHaveAttribute(
      'href',
      `/fr/services/consultation/reserver?creneau=${encodeURIComponent(at('2026-11-26', '09:00'))}`,
    );
  });

  it('shows a day booked full, and does not let it be chosen', () => {
    renderPage();
    expect(within(panel()).getByRole('radio', { name: /mercredi 25 novembre · complet/i })).toBeDisabled();
  });

  it('books the day and time the visitor picks', () => {
    renderPage();
    fireEvent.click(within(panel()).getByRole('radio', { name: /vendredi 27 novembre/i }));
    expect(within(panel()).getByText('Vendredi 27 novembre')).toBeInTheDocument();
    expect(within(panel()).getByRole('link', { name: /Réserver ven\. 27 à 14:00/ })).toHaveAttribute(
      'href',
      `/fr/services/consultation/reserver?creneau=${encodeURIComponent(at('2026-11-27', '14:00'))}`,
    );

    fireEvent.click(within(panel()).getByRole('radio', { name: /jeudi 26 novembre/i }));
    fireEvent.click(within(panel()).getByRole('radio', { name: '11:00' }));
    expect(within(panel()).getByRole('link', { name: /Réserver jeu\. 26 à 11:00/ })).toBeInTheDocument();
  });

  it('says when nothing is free, with no way to book', () => {
    renderPage({ ...SLOTS, days: [{ day: '2026-11-25', starts: [] }] });
    expect(within(panel()).getByText(/Aucun créneau libre pour le moment/)).toBeInTheDocument();
    expect(within(panel()).queryByRole('link', { name: /Réserver/ })).not.toBeInTheDocument();
  });

  it('shows no price until the consultant sets one', () => {
    renderPage({ ...SLOTS, price: null });
    expect(within(panel()).getByText('45 min en vidéo · Heure de Douala')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPage();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ConsultationView, the Consultation as the consultant set it', () => {
  it('writes the length and how late it can be moved from the Disponibilités, not the defaults', () => {
    renderPage({ ...SLOTS, durationMinutes: 60, moveCutoffHours: 48 });
    expect(screen.getByText(/^60 minutes en vidéo avec Stanzy/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '60 min avec Stanzy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Puis-je déplacer mon rendez-vous/ }));
    expect(screen.getByText(/jusqu’à 48 h avant le début/)).toBeInTheDocument();
  });

  it('shows the page’s shape while the slots load', () => {
    const { wrap } = createTestTRPC({ 'consultation.slots': () => new Promise(() => {}) });
    render(withIntl(wrap(<ConsultationView />)));
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument();
  });
});

describe('ConsultationView, « Ce qu’on aborde »', () => {
  const tabs = () => within(screen.getByRole('tablist', { name: 'Les sujets' }));
  const preview = () => screen.getByRole('tabpanel');
  /**
   * The line under the shown topic finishing its run (its CSS animation ending). jsdom has no
   * AnimationEvent, so React listens for the prefixed `webkitAnimationEnd` there.
   */
  const progressEnds = () =>
    fireEvent(screen.getAllByTestId('topic-progress')[0]!, new Event('webkitAnimationEnd', { bubbles: true }));

  it('shows the preview of the topic the visitor picks', () => {
    renderPage();
    fireEvent.click(tabs().getByRole('tab', { name: /Vos documents/ }));
    expect(tabs().getByRole('tab', { name: /Vos documents/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(preview()).getByText('Test de langue')).toBeInTheDocument();
  });

  it('moves on to the next topic by itself, until the visitor picks one', () => {
    renderPage();
    progressEnds();
    expect(tabs().getByRole('tab', { name: /Gagner des points/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(tabs().getByRole('tab', { name: /La suite/ }));
    expect(screen.queryAllByTestId('topic-progress')).toHaveLength(0);
  });

  it('comes back to the first topic after the last', () => {
    renderPage();
    for (let i = 0; i < 4; i += 1) progressEnds();
    expect(tabs().getByRole('tab', { name: /Votre admissibilité/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ConsultationView, « Un aperçu de votre récap »', () => {
  const demo = () => within(screen.getByRole('group', { name: 'Exemple de récap' }));

  it('moves the video to the moment the visitor taps', () => {
    renderPage();
    expect(demo().getByText('09:12 · Points CRS')).toBeInTheDocument();
    const moment = demo().getByRole('button', { name: /Aller à 02:40/ });
    fireEvent.click(moment);
    expect(moment).toHaveAttribute('aria-current', 'true');
    expect(demo().getByText('02:40 · Admissibilité')).toBeInTheDocument();
  });

  it('ticks and unticks a next step, and counts them', () => {
    renderPage();
    expect(demo().getByText('Prochaines étapes · 1 sur 3')).toBeInTheDocument();
    const step = demo().getByRole('checkbox', { name: 'Faire évaluer votre diplôme' });
    fireEvent.click(step);
    expect(step).toBeChecked();
    expect(demo().getByText('Prochaines étapes · 2 sur 3')).toBeInTheDocument();
    fireEvent.click(demo().getByRole('checkbox', { name: 'Passer le test de langue' }));
    expect(demo().getByText('Prochaines étapes · 1 sur 3')).toBeInTheDocument();
  });
});

describe('ConsultationView, FAQ', () => {
  it('opens one answer at a time', async () => {
    renderPage();
    const move = screen.getByRole('button', { name: /Puis-je déplacer/ });
    fireEvent.click(move);
    expect(move).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Faut-il installer/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(move);
    await waitFor(() => expect(screen.queryByText(/jusqu’à 24 h avant le début/)).not.toBeInTheDocument());
  });
});
