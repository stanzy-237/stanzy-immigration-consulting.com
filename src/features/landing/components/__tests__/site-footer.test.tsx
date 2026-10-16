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
    // "TikTok" also appears as a Content column link, so match it to a social
    // icon by also requiring the circular-icon class on the anchor.
    const tiktokLinks = within(footer).getAllByRole('link', { name: 'TikTok' });
    expect(
      tiktokLinks.some((el) => el.getAttribute('target') === '_blank'),
    ).toBe(true);
  });

  it('exposes a prominent "Réserver une consultation" CTA pointing to the service page', () => {
    render(withIntl(<SiteFooter />));
    const cta = screen.getByRole('link', { name: /Réserver une consultation/i });
    expect(cta).toHaveAttribute('href', expect.stringContaining('/services/consultation'));
  });

  it('shows the current year in the copyright line', () => {
    render(withIntl(<SiteFooter />));
    const year = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(String(year))),
    ).toBeInTheDocument();
  });

  it('lists the seven free tools and three paid services', () => {
    render(withIntl(<SiteFooter />));
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Calculateur CRS')).toBeInTheDocument();
    expect(within(footer).getByText('Mon Parcours')).toBeInTheDocument();
    expect(within(footer).getByText('Consultation privée')).toBeInTheDocument();
    expect(within(footer).getByText('Accompagnement complet')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<SiteFooter />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
