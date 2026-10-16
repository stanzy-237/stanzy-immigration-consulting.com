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
    for (const label of ['Facebook', 'Instagram', 'WhatsApp']) {
      const link = within(footer).getByRole('link', { name: label });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
    const tiktokLinks = within(footer).getAllByRole('link', { name: 'TikTok' });
    expect(
      tiktokLinks.some((el) => el.getAttribute('target') === '_blank'),
    ).toBe(true);
  });

  it('shows the brand logo as a round white-background image', () => {
    render(withIntl(<SiteFooter />));
    const img = screen.getByAltText('STANZY IMMIGRATION');
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src') ?? '').toContain('Logo-white-background');
    expect(img.closest('span')).toHaveClass('rounded-full');
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
    expect(screen.getByText(new RegExp(String(year)))).toBeInTheDocument();
    expect(screen.getByText(/Fait avec/)).toBeInTheDocument();
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

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<SiteFooter />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
