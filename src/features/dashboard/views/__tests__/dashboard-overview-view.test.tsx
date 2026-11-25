// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DashboardShell } from '@/features/dashboard/components/dashboard-shell';
import { DashboardOverviewView } from '@/features/dashboard/views/dashboard-overview-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Tableau de bord as the consultant sees it, its shell around the Aperçu. */
/** The route segments below the dashboard's layout: [] is the Aperçu. */
const nav = vi.hoisted(() => ({ segments: [] as string[] }));
vi.mock('next/navigation', () => ({
  useSelectedLayoutSegments: () => nav.segments,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

type Summary = { drafts: number; published: number; lastPublished: { id: string; title: string; publishedAt: Date } | null };
let summary: Summary | undefined;

beforeEach(() => {
  nav.segments = [];
  summary = {
    drafts: 2,
    published: 1,
    lastPublished: { id: 'post_2', title: 'Réussir le TCF Canada', publishedAt: new Date('2026-10-21T09:00:00Z') },
  };
});

/** The Aperçu as the route serves it: the summary prefetched, unless `summary` is unset (still on its way). */
const SYNC = { lastSyncedAt: new Date(Date.now() - 3 * 3600_000), newest: { round: '450', date: new Date('2026-10-06T00:00:00Z'), crsMin: 435, typeLabel: 'French' } };
const refreshDraws = vi.fn(() => ({ inserted: 1, updated: 0, alerted: 1 }));

const page = () => {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'blog.dashboard.summary': () => new Promise(() => {}),
    'draws.sync': () => SYNC,
    'draws.refresh': refreshDraws,
  });
  if (summary) queryClient.setQueryData(trpc.blog.dashboard.summary.queryKey(), summary);
  queryClient.setQueryData(trpc.draws.sync.queryKey(), SYNC as never);
  return render(
    withIntl(
      wrap(
        <DashboardShell name="Stanzy" siteUrl="https://stanzy-immigration-consulting.com/fr">
          <DashboardOverviewView />
        </DashboardShell>,
      ),
    ),
  );
};
describe('Tableau de bord — shell', () => {
  it('lists its sections and marks the one open', () => {
    page();
    const sections = within(screen.getAllByRole('navigation', { name: 'Sections du tableau de bord' })[0]!);
    expect(sections.getByRole('link', { name: 'Aperçu' })).toHaveAttribute('aria-current', 'page');
    expect(sections.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog');
    expect(sections.getByRole('link', { name: 'Blog' })).not.toHaveAttribute('aria-current');
  });

  it('marks Blog while an Article is open in the editor', () => {
    nav.segments = ['blog', 'post_2'];
    page();
    const sections = within(screen.getAllByRole('navigation', { name: 'Sections du tableau de bord' })[0]!);
    expect(sections.getByRole('link', { name: 'Blog' })).toHaveAttribute('aria-current', 'page');
    expect(sections.getByRole('link', { name: 'Aperçu' })).not.toHaveAttribute('aria-current');
  });

  it('greets the consultant and links back to the public site on the main domain', () => {
    page();
    expect(screen.getByText('Bonjour Stanzy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir le site/ })).toHaveAttribute('href', 'https://stanzy-immigration-consulting.com/fr');
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
    expect(blog.getByRole('link', { name: /Nouvel article/ })).toHaveAttribute('href', '/blog/nouveau');
    expect(blog.getByRole('link', { name: 'Tous les articles' })).toHaveAttribute('href', '/blog');
  });

  it('says so before the first Article is published', () => {
    summary = { drafts: 0, published: 0, lastPublished: null };
    page();
    expect(screen.getByText('Aucun article publié pour l’instant.')).toBeInTheDocument();
  });

  it('holds the Blog’s place with a skeleton while its counts arrive, not a loading sentence', () => {
    summary = undefined;
    page();
    const blog = within(screen.getByRole('region', { name: 'Blog' }));
    expect(blog.getByRole('status')).toBeInTheDocument();
    expect(blog.queryByText(/brouillon/)).not.toBeInTheDocument();
    expect(blog.getByRole('link', { name: /Nouvel article/ })).toBeInTheDocument();
  });

  it('shows when IRCC’s feed was last read, and refreshes the Tirages on demand', async () => {
    page();
    const draws = within(screen.getByRole('region', { name: 'Tirages IRCC' }));
    expect(draws.getByText(/il y a 3 heures/)).toBeInTheDocument();
    expect(draws.getByText(/n° 450 · 6 oct\. · CRS 435/)).toBeInTheDocument();
    fireEvent.click(draws.getByRole('button', { name: 'Actualiser maintenant' }));
    await waitFor(() => expect(refreshDraws).toHaveBeenCalled());
  });

  it('has no axe violations', async () => {
    const { container } = page();
    expect(await axe(container)).toHaveNoViolations();
  });
});
