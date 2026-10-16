// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Hero } from '@/features/landing/components/hero';
import * as analytics from '@/lib/analytics';

import { withIntl } from './test-utils';

describe('Hero', () => {
  it('renders the headline with the accent word highlighted', () => {
    render(withIntl(<Hero />));
    expect(
      screen.getByRole('heading', { level: 1, name: /Immigrez au Canada avec Confiance/i }),
    ).toBeInTheDocument();
  });

  it('exposes the two primary CTAs', () => {
    render(withIntl(<Hero />));
    const book = screen.getByRole('link', { name: /Réserver une consultation/i });
    expect(book).toHaveAttribute('href', expect.stringContaining('/services/consultation'));

    const whatsapp = screen.getByRole('link', { name: /Rejoindre WhatsApp/i });
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(whatsapp).toHaveAttribute('href', expect.stringContaining('wa.me'));
  });

  it('fires analytics events when the CTAs are clicked', () => {
    const spy = vi.spyOn(analytics, 'track');
    render(withIntl(<Hero />));

    fireEvent.click(screen.getByRole('link', { name: /Réserver une consultation/i }));
    fireEvent.click(screen.getByRole('link', { name: /Rejoindre WhatsApp/i }));

    expect(spy).toHaveBeenCalledWith('hero.cta.book');
    expect(spy).toHaveBeenCalledWith('hero.cta.whatsapp');
    spy.mockRestore();
  });

  it('renders the three proof stat tiles', () => {
    render(withIntl(<Hero />));
    const list = screen.getAllByRole('list')[0];
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(within(list).getByText('5+')).toBeInTheDocument();
    expect(within(list).getByText('120+')).toBeInTheDocument();
    expect(within(list).getByText('80%')).toBeInTheDocument();
    expect(within(list).getByText(/outils gratuits/i)).toBeInTheDocument();
  });

  it('renders the floating CRS score card linking to the calculator', () => {
    render(withIntl(<Hero />));
    const cta = screen.getByRole('link', { name: /Calculer mon score/i });
    expect(cta).toHaveAttribute('href', expect.stringContaining('/outils/crs'));
  });

  it('fires hero.scoreCard when the score card CTA is clicked', () => {
    const spy = vi.spyOn(analytics, 'track');
    render(withIntl(<Hero />));
    fireEvent.click(screen.getByRole('link', { name: /Calculer mon score/i }));
    expect(spy).toHaveBeenCalledWith(
      'hero.scoreCard',
      expect.objectContaining({ score: expect.any(Number) }),
    );
    spy.mockRestore();
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<Hero />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
