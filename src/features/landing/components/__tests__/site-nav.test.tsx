// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { SiteNav } from '@/features/landing/components/site-nav';

import { withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: { useSession: vi.fn(), signOut: vi.fn() },
}));

const useSession = vi.mocked(authClient.useSession);

function signedInAs(name: string) {
  useSession.mockReturnValue({
    data: { user: { name, email: 'aminata@example.com' }, session: {} },
    isPending: false,
  } as never);
}

describe('SiteNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.mockReturnValue({ data: null, isPending: false } as never);
  });

  it('renders the primary navigation landmark with the top-level links', () => {
    render(withIntl(<SiteNav />));
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Blog' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Connexion' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Commencer' })).toBeInTheDocument();
  });

  it('sends Commencer to account creation', () => {
    render(withIntl(<SiteNav />));
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Commencer' })).toHaveAttribute(
      'href',
      '/fr/inscription',
    );
  });

  it('exposes the brand logo at /logo2.png with an accessible name', () => {
    render(withIntl(<SiteNav />));
    const logo = screen.getByAltText('Stanzy');
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('src') ?? '').toContain('logo2');
  });

  it('opens the Outils dropdown on pointer hover and lists the seven tools', () => {
    render(withIntl(<SiteNav />));
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu Outils' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const item = trigger.closest('li')!;
    fireEvent.mouseEnter(item);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const panel = document.getElementById(trigger.getAttribute('aria-controls')!);
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('aria-hidden')).toBe('false');
    expect(within(panel!).getAllByRole('link')).toHaveLength(7);
    expect(within(panel!).getByText('Calculateur CRS')).toBeInTheDocument();
    expect(within(panel!).getByText('Dernier tirage')).toBeInTheDocument();
  });

  it('marks the Dernier tirage entry with a live IRCC leaf icon', () => {
    render(withIntl(<SiteNav />));
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu Outils' });
    fireEvent.mouseEnter(trigger.closest('li')!);
    expect(screen.getByLabelText('Données IRCC en direct')).toBeInTheDocument();
  });

  it('opens the Services dropdown on hover and lists the three paid services', () => {
    render(withIntl(<SiteNav />));
    const trigger = screen.getByRole('button', {
      name: 'Ouvrir le menu Services',
    });
    fireEvent.mouseEnter(trigger.closest('li')!);
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!);
    expect(panel).not.toBeNull();
    expect(within(panel!).getAllByRole('link')).toHaveLength(3);
    expect(within(panel!).getByText('Consultation privée')).toBeInTheDocument();
  });

  it('also toggles a dropdown on click so keyboard activation works', () => {
    render(withIntl(<SiteNav />));
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu Outils' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes an open dropdown on Escape', () => {
    render(withIntl(<SiteNav />));
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu Outils' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders a mobile hamburger trigger for the Sheet menu', () => {
    render(withIntl(<SiteNav />));
    expect(
      screen.getByRole('button', { name: 'Ouvrir le menu' }),
    ).toBeInTheDocument();
  });

  it('has no axe violations in its closed state', async () => {
    const { container } = render(withIntl(<SiteNav />));
    expect(await axe(container)).toHaveNoViolations();
  });

  describe('when signed in', () => {
    it('replaces Connexion with an account menu named after the Account', () => {
      signedInAs('Aminata Diallo');
      render(withIntl(<SiteNav />));
      const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
      expect(within(nav).queryByRole('link', { name: 'Connexion' })).toBeNull();
      expect(
        within(nav).getByRole('button', { name: 'Mon compte : Aminata Diallo' }),
      ).toBeInTheDocument();
    });

    it('signs out from the account menu', async () => {
      signedInAs('Aminata Diallo');
      vi.mocked(authClient.signOut).mockResolvedValue({ data: {}, error: null } as never);
      render(withIntl(<SiteNav />));

      fireEvent.click(screen.getByRole('button', { name: 'Mon compte : Aminata Diallo' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Déconnexion' }));

      await waitFor(() => expect(authClient.signOut).toHaveBeenCalled());
    });

    it('has no axe violations', async () => {
      signedInAs('Aminata Diallo');
      const { container } = render(withIntl(<SiteNav />));
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
