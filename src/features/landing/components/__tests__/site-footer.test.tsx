// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { SiteFooter } from '@/features/landing/components/site-footer';

import { withIntl } from './test-utils';

describe('SiteFooter', () => {
  it('renders a contentinfo landmark with the four social links', () => {
    render(withIntl(<SiteFooter />));
    const footer = screen.getByRole('contentinfo');
    // Once in the desktop footer, once in the phone one.
    for (const label of ['Facebook', 'Instagram', 'WhatsApp']) {
      const links = within(footer).getAllByRole('link', { name: label });
      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      }
    }
    const tiktokLinks = within(footer).getAllByRole('link', { name: 'TikTok' });
    expect(
      tiktokLinks.some((el) => el.getAttribute('target') === '_blank'),
    ).toBe(true);
  });

  it('shows the brand logo as a round white-background image', () => {
    render(withIntl(<SiteFooter />));
    // The desktop footer's and the phone footer's: the same round logo.
    const imgs = screen.getAllByAltText('STANZY IMMIGRATION');
    expect(imgs).toHaveLength(2);
    for (const img of imgs) {
      expect(img.tagName).toBe('IMG');
      expect(img.getAttribute('src') ?? '').toContain('Logo-white-background');
      expect(img.closest('.rounded-full')).not.toBeNull();
    }
  });

  it('exposes the "Réserver une consultation" CTA pointing to the service page', () => {
    render(withIntl(<SiteFooter />));
    const cta = screen.getByRole('link', { name: /Réserver une consultation/i });
    expect(cta).toHaveAttribute(
      'href',
      expect.stringContaining('/services/consultation'),
    );
  });

  it('shows the current year and "Fait avec" tagline in the copyright line', () => {
    render(withIntl(<SiteFooter />));
    const year = new Date().getFullYear();
    expect(screen.getAllByText(new RegExp(String(year))).length).toBeGreaterThan(0);
    // Desktop: « Fait avec ♥ pour la communauté » ; phone: « Fait avec ♥ à Douala · © year ».
    expect(screen.getAllByText(/Fait avec/)).toHaveLength(2);
    expect(screen.getByText(new RegExp(`Fait avec ♥ à Douala · © ${year} Stanzy`))).toBeInTheDocument();
  });

  it('lists the tools and services from the design', () => {
    render(withIntl(<SiteFooter />));
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Timeline Immigration')).toBeInTheDocument();
    expect(within(footer).getByText('Calculateur CRS')).toBeInTheDocument();
    expect(within(footer).getByText('Recherche code CNP')).toBeInTheDocument();
    expect(within(footer).getByText('Consultation privée')).toBeInTheDocument();
    expect(within(footer).getByText('TCF Express Academy')).toBeInTheDocument();
    expect(within(footer).getByText('EDE — WES & IQUAS')).toBeInTheDocument();
  });

  it('shows the contact details from the design', () => {
    render(withIntl(<SiteFooter />));
    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer).getByText('contact@stanzy-immigration-consulting.com'),
    ).toBeInTheDocument();
    expect(within(footer).getByText('+237 679 306 015')).toBeInTheDocument();
    expect(within(footer).getByText('Douala, Cameroun')).toBeInTheDocument();
  });

  it('titles its columns as level-2 headings, so any page above it keeps a valid outline', () => {
    render(withIntl(<SiteFooter />));
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).queryAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(within(footer).queryAllByRole('heading', { level: 4 })).toHaveLength(0);
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<SiteFooter />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
