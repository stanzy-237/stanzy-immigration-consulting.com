// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsultationCta } from '@/features/landing/components/consultation-cta';
import { Draws } from '@/features/landing/components/draws';
import { Faq } from '@/features/landing/components/faq';
import { ServicesGrid } from '@/features/landing/components/services-grid';
import { Subscribe } from '@/features/landing/components/subscribe';
import { WhyStanzy } from '@/features/landing/components/why-stanzy';

import { withIntl } from './test-utils';

describe('Draws', () => {
  it('shows the featured round and three secondary rounds', () => {
    render(withIntl(<Draws />));
    expect(screen.getByText('#345')).toBeInTheDocument();
    expect(screen.getByText(/Tirage #344/)).toBeInTheDocument();
    expect(screen.getByText(/Tirage #343/)).toBeInTheDocument();
    expect(screen.getByText(/Tirage #342/)).toBeInTheDocument();
  });
  it('exposes "Calculer mon score" linking to the latest draw tool', () => {
    render(withIntl(<Draws />));
    const link = screen.getByRole('link', { name: /Calculer mon score/i });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/outils/dernier-tirage'),
    );
  });
});

describe('ConsultationCta', () => {
  it('renders a Booker CTA that routes to /services/consultation', () => {
    render(withIntl(<ConsultationCta />));
    const cta = screen.getByRole('link', { name: /Booker une consultation/i });
    expect(cta).toHaveAttribute(
      'href',
      expect.stringContaining('/services/consultation'),
    );
  });
});

describe('ServicesGrid', () => {
  it('renders four service cards with correct hrefs', () => {
    render(withIntl(<ServicesGrid />));
    const expected: ReadonlyArray<[RegExp, string]> = [
      [/Accompagnement Entrée Express/i, '/services/accompagnement'],
      [/Vérification & soumission/i, '/services/verification'],
      [/Formation TCF Canada/i, 'tcf-express-academy.com'],
      [/Évaluation des Diplômes/i, '/services/ede'],
    ];
    for (const [name, href] of expected) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', expect.stringContaining(href));
    }
  });
  it('opens the external TCF service in a new tab', () => {
    render(withIntl(<ServicesGrid />));
    const link = screen.getByRole('link', { name: /Formation TCF Canada/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

describe('WhyStanzy', () => {
  it('surfaces three value props and the featured proof pill', () => {
    render(withIntl(<WhyStanzy />));
    expect(screen.getByText(/experts, pas des stagiaires/i)).toBeInTheDocument();
    expect(screen.getByText(/Un seul interlocuteur/i)).toBeInTheDocument();
    expect(screen.getByText(/outils gratuits, toujours accessibles/i)).toBeInTheDocument();
    expect(screen.getByText('80% de réussite')).toBeInTheDocument();
  });
});

describe('Subscribe', () => {
  it('renders an email input and a WhatsApp channel link', () => {
    render(withIntl(<Subscribe />));
    expect(
      screen.getByPlaceholderText(/exemple@email\.com/i),
    ).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', {
      name: /Rejoindre le canal WhatsApp/i,
    });
    expect(whatsapp).toHaveAttribute(
      'href',
      expect.stringContaining('whatsapp.com/channel/'),
    );
    expect(whatsapp).toHaveAttribute('target', '_blank');
  });
});

describe('Faq', () => {
  it('opens the first item by default and toggles another on click', () => {
    render(withIntl(<Faq />));
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  });
});
