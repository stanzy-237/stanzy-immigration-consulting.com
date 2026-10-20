// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { BlogRow } from '@/features/landing/components/blog-row';

import { withIntl } from './test-utils';

describe('BlogRow', () => {
  it('renders the header with the accent part highlighted', () => {
    render(withIntl(<BlogRow />));
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toMatch(/Conseils d'experts,/);
    expect(within(heading).getByText('sans jargon.')).toHaveClass(
      'text-rouge',
    );
  });

  it('exposes a "see all articles" link to /blog', () => {
    render(withIntl(<BlogRow />));
    const link = screen.getByRole('link', { name: /Voir tous les articles/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/blog'));
  });

  it('renders six articles with blog slugs', () => {
    render(withIntl(<BlogRow />));
    const expected: ReadonlyArray<[RegExp, string]> = [
      [/maximiser votre score CRS en 90 jours/i, '/blog/maximiser-crs-90-jours'],
      [/10 documents indispensables pour votre dossier ITA/i, '/blog/documents-ita'],
      [/PNP vs Entrée Express/i, '/blog/pnp-vs-entree-express'],
      [/IELTS ou TEF/i, '/blog/ielts-ou-tef'],
      [/Évaluation de diplôme WES/i, '/blog/wes-procedure'],
      [/5 erreurs qui font rejeter/i, '/blog/erreurs-dossier-entree-express'],
    ];
    for (const [name, href] of expected) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', expect.stringContaining(href));
    }
  });

  it('shows the full excerpt only on the featured article', () => {
    render(withIntl(<BlogRow />));
    expect(
      screen.getByText(/Découvrez les stratégies prouvées/i),
    ).toBeInTheDocument();
  });

  it('is free of axe violations', async () => {
    const { container } = render(withIntl(<BlogRow />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
