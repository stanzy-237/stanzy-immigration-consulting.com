// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { SiteNav } from '@/features/landing/components/site-nav';

import { withIntl } from './test-utils';

describe('SiteNav', () => {
  it('renders the primary navigation landmark with the top-level links', () => {
    render(withIntl(<SiteNav />));
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Accueil' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Blog' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Connexion' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Commencer' })).toBeInTheDocument();
  });

  it('opens the Outils dropdown on click and lists the seven tools', () => {
    render(withIntl(<SiteNav />));
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu Outils' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(7);
    expect(within(menu).getByText('Calculateur CRS')).toBeInTheDocument();
    expect(within(menu).getByText('Dernier tirage')).toBeInTheDocument();
  });

  it('marks the Dernier tirage entry with a live IRCC leaf icon', () => {
    render(withIntl(<SiteNav />));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu Outils' }));
    expect(
      screen.getByLabelText('Données IRCC en direct'),
    ).toBeInTheDocument();
  });

  it('opens the Services dropdown and lists the three paid services', () => {
    render(withIntl(<SiteNav />));
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu Services' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    expect(within(menu).getByText('Consultation privée')).toBeInTheDocument();
  });

  it('closes an open dropdown on Escape', () => {
    render(withIntl(<SiteNav />));
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu Outils' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles the mobile menu button between open and closed labels', () => {
    render(withIntl(<SiteNav />));
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(burger);
    expect(
      screen.getByRole('button', { name: 'Fermer le menu' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('has no axe violations', async () => {
    const { container } = render(withIntl(<SiteNav />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
