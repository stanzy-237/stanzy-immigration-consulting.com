// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import type { ArticleCard } from '@/features/blog/server/blog-queries';
import { BlogRow } from '@/features/landing/components/blog-row';

import { withIntl } from './test-utils';

const EXPRESS_ENTRY = { slug: 'entree-express', nameFr: 'Entrée Express', nameEn: 'Express Entry' };
const card = (n: number, overrides: Partial<ArticleCard> = {}): ArticleCard => ({
  slug: `article-${n}`,
  locale: 'fr',
  title: `Article ${n}`,
  excerpt: `Résumé de l’article ${n}.`,
  coverUrl: null,
  coverAlt: null,
  category: EXPRESS_ENTRY,
  tags: [],
  publishedAt: new Date(`2026-10-${String(20 - n).padStart(2, '0')}T08:00:00Z`),
  readingMinutes: n,
  ...overrides,
});
const SIX = [1, 2, 3, 4, 5, 6].map((n) => card(n));

describe('BlogRow', () => {
  it('renders the header with the accent part highlighted', () => {
    render(withIntl(<BlogRow articles={SIX} locale="fr" />));
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toMatch(/Conseils d'experts,/);
    expect(within(heading).getByText('sans jargon.')).toHaveClass('text-rouge');
  });

  it('exposes a "see all articles" link to /blog', () => {
    render(withIntl(<BlogRow articles={SIX} locale="fr" />));
    const link = screen.getByRole('link', { name: /Voir tous les articles/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/blog'));
  });

  it('links each of the latest Articles to its page', () => {
    render(withIntl(<BlogRow articles={SIX} locale="fr" />));
    expect(screen.getByRole('link', { name: "Ouvrir l'article : Article 1" })).toHaveAttribute('href', expect.stringContaining('/blog/article-1'));
    for (const n of [4, 5, 6]) {
      expect(screen.getByRole('link', { name: new RegExp(`Article ${n}`) })).toHaveAttribute('href', expect.stringContaining(`/blog/article-${n}`));
    }
  });

  it('shows the excerpt only on the featured Article, with its date and reading time', () => {
    render(withIntl(<BlogRow articles={SIX} locale="fr" />));
    expect(screen.getByText('Résumé de l’article 1.')).toBeInTheDocument();
    expect(screen.queryByText('Résumé de l’article 2.')).not.toBeInTheDocument();
    expect(screen.getByText('19 oct. 2026')).toBeInTheDocument();
    expect(screen.getByText('1 min de lecture')).toBeInTheDocument();
  });

  it('names the category in the visitor’s language', () => {
    render(withIntl(<BlogRow articles={[card(1)]} locale="en" />, 'en'));
    expect(screen.getByText('Express Entry')).toBeInTheDocument();
  });

  it('is hidden until the first Article is published', () => {
    const { container } = render(withIntl(<BlogRow articles={[]} locale="fr" />));
    expect(container).toBeEmptyDOMElement();
  });

  it('is free of axe violations', async () => {
    const { container } = render(withIntl(<BlogRow articles={SIX} locale="fr" />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
