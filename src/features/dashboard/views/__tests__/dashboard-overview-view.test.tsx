// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DashboardShell } from '@/features/dashboard/components/dashboard-shell';
import { DashboardOverviewView } from '@/features/dashboard/views/dashboard-overview-view';

/** Seam: the Tableau de bord as the consultant sees it, its shell around the Aperçu. */
const nav = vi.hoisted(() => ({ pathname: '/tableau-de-bord' }));
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const summary = vi.hoisted(() => ({
  data: undefined as
    | { drafts: number; published: number; lastPublished: { id: string; title: string; publishedAt: Date } | null }
    | undefined,
}));
vi.mock('@/trpc/react', () => ({
  api: { blog: { admin: { summary: { useQuery: () => ({ data: summary.data, isLoading: !summary.data }) } } } },
}));

beforeEach(() => {
  nav.pathname = '/tableau-de-bord';
  summary.data = {
    drafts: 2,
    published: 1,
    lastPublished: { id: 'post_2', title: 'Réussir le TCF Canada', publishedAt: new Date('2026-10-21T09:00:00Z') },
  };
});

const page = () =>
  render(
    withIntl(
      <DashboardShell name="Stanzy">
        <DashboardOverviewView />
      </DashboardShell>,
    ),
  );

describe('Tableau de bord — shell', () => {
  it('lists its sections and marks the one open', () => {
    page();
    const sections = within(screen.getAllByRole('navigation', { name: 'Sections du tableau de bord' })[0]!);
    expect(sections.getByRole('link', { name: 'Aperçu' })).toHaveAttribute('aria-current', 'page');
    expect(sections.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/tableau-de-bord/blog');
    expect(sections.getByRole('link', { name: 'Blog' })).not.toHaveAttribute('aria-current');
  });

  it('marks Blog while an Article is open in the editor', () => {
    nav.pathname = '/tableau-de-bord/blog/post_2';
    page();
    const sections = within(screen.getAllByRole('navigation', { name: 'Sections du tableau de bord' })[0]!);
    expect(sections.getByRole('link', { name: 'Blog' })).toHaveAttribute('aria-current', 'page');
    expect(sections.getByRole('link', { name: 'Aperçu' })).not.toHaveAttribute('aria-current');
  });

  it('greets the consultant and links back to the public site', () => {
    page();
    expect(screen.getByText('Bonjour Stanzy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir le site/ })).toHaveAttribute('href', '/');
  });
});

describe('Tableau de bord — Aperçu', () => {
  it('shows the Blog at a glance, with a shortcut to a new Article', () => {
    page();
    expect(screen.getByRole('heading', { level: 1, name: 'Aperçu' })).toBeInTheDocument();
    const blog = within(screen.getByRole('region', { name: 'Blog' }));
    expect(blog.getByText('2 brouillons')).toBeInTheDocument();
    expect(blog.getByText('1 article publié')).toBeInTheDocument();
    expect(blog.getByText('Dernier publié : Réussir le TCF Canada, le 21 oct. 2026')).toBeInTheDocument();
    expect(blog.getByRole('link', { name: /Nouvel article/ })).toHaveAttribute('href', '/tableau-de-bord/blog/nouveau');
    expect(blog.getByRole('link', { name: 'Tous les articles' })).toHaveAttribute('href', '/tableau-de-bord/blog');
  });

  it('says so before the first Article is published', () => {
    summary.data = { drafts: 0, published: 0, lastPublished: null };
    page();
    expect(screen.getByText('Aucun article publié pour l’instant.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = page();
    expect(await axe(container)).toHaveNoViolations();
  });
});
