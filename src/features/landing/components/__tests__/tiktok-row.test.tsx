// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { TikTokRow } from '@/features/landing/components/tiktok-row';
import { TIKTOK_VIDEOS } from '@/features/landing/data/tiktok-videos';

import { withIntl } from './test-utils';

describe('TikTokRow', () => {
  it('renders the section with the eyebrow + split title', () => {
    render(withIntl(<TikTokRow />));
    expect(
      screen.getByRole('region', { name: /Des conseils/i }),
    ).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toMatch(/Des conseils/);
    expect(within(heading).getByText('clairs')).toHaveClass('text-rouge');
  });

  it('exposes the "Voir tous nos TikToks" CTA pointing at the channel', () => {
    render(withIntl(<TikTokRow />));
    const cta = screen.getByRole('link', { name: /Voir tous nos TikToks/i });
    expect(cta).toHaveAttribute('href', 'https://www.tiktok.com/@stanzycanada');
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders six video cards wired to the real @stanzycanada URLs', () => {
    render(withIntl(<TikTokRow />));
    const allLinks = screen.getAllByRole('link');
    for (const v of TIKTOK_VIDEOS) {
      const link = allLinks.find((a) => a.getAttribute('href') === v.href);
      expect(link, `video ${v.key} link`).toBeDefined();
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
    expect(TIKTOK_VIDEOS).toHaveLength(6);
  });

  it('shows the real title we have for the Dernier tirage video', () => {
    render(withIntl(<TikTokRow />));
    expect(
      screen.getByText('Dernier tirage Entrée Express'),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<TikTokRow />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
