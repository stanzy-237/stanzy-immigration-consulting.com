// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
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
