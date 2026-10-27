// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ToolsGrid } from '@/features/landing/components/tools-grid';

import { withIntl } from './test-utils';

describe('ToolsGrid', () => {
  it('renders the section heading with the accent part highlighted', () => {
    render(withIntl(<ToolsGrid />));
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toMatch(/Vos outils d'immigration\./);
    expect(within(heading).getByText('100% gratuits.')).toHaveClass(
      'text-rouge',
    );
  });

  it('renders all nine tools linking to their routes', () => {
    render(withIntl(<ToolsGrid />));
    const expected: ReadonlyArray<[RegExp, string]> = [
      [/Timeline Immigration/i, '/outils/timeline'],
      [/Calculateur NCLC \/ CLB/i, '/outils/nclc-clb'],
      [/Compte à rebours ITA/i, '/outils/compte-a-rebours-ita'],
      [/Calculateur de 67 points/i, '/outils/67-points'],
      [/Calculateur CRS/i, '/outils/crs'],
      [/Dernier tirage Entrée Express/i, '/outils/dernier-tirage'],
      [/Prédiction du prochain tirage/i, '/outils/prochain-tirage'],
      [/Budget & dépenses/i, '/outils/budget'],
      [/Recherche code CNP/i, '/outils/cnp'],
    ];
    for (const [name, href] of expected) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', expect.stringContaining(href));
    }
  });

  it('offers the NCLC / CLB calculator in place of the Clouds card', () => {
    render(withIntl(<ToolsGrid />));
    const card = screen.getByRole('link', { name: /Calculateur NCLC \/ CLB/i });
    expect(within(card).getByText('NCLC · CLB')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Clouds/i })).not.toBeInTheDocument();
  });

  it('marks Recherche CNP as coming soon, last in the grid', () => {
    render(withIntl(<ToolsGrid />));
    const cards = screen.getAllByRole('link', { name: /^Ouvrir l'outil/ });
    const cnp = screen.getByRole('link', { name: /Recherche code CNP — bientôt disponible/ });

    expect(within(cnp).getByText('Bientôt')).toBeInTheDocument();
    expect(within(cnp).queryByText('Gratuit')).not.toBeInTheDocument();
    expect(cards.at(-1)).toBe(cnp);
    for (const card of cards.slice(0, -1)) expect(within(card).queryByText('Bientôt')).toBeNull();
  });

  it('surfaces the live-data badge on the Dernier tirage card', () => {
    render(withIntl(<ToolsGrid />));
    const drawLink = screen.getByRole('link', {
      name: /Dernier tirage Entrée Express/i,
    });
    expect(within(drawLink).getByText('En temps réel')).toBeInTheDocument();
  });

  it('shows the footer tally line', () => {
    render(withIntl(<ToolsGrid />));
    // Recherche CNP is not built yet, so it is not counted.
    expect(screen.getByText('8 outils')).toBeInTheDocument();
    expect(screen.getByText(/^8 outils gratuits pour simplifier votre parcours/)).toBeInTheDocument();
    expect(
      screen.getByText(/Aucune inscription · 100% gratuits/),
    ).toBeInTheDocument();
  });

  it('is free of axe violations', async () => {
    const { container } = render(withIntl(<ToolsGrid />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
