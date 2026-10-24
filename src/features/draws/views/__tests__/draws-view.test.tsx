// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { CRS_DRAFT_KEY } from '@/features/crs/hooks/use-crs-draft';
import { fromProfile } from '@/features/crs/lib/crs-form';
import type { DrawGroup } from '@/features/draws/lib/normalize-ircc-rounds';
import type { DrawSummary } from '@/features/draws/server/draws-router';
import { DrawsView } from '@/features/draws/views/draws-view';

/** Seam: the Derniers tirages page as a visitor uses it, fed fixture Tirages. */
const IRCC = 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds/invitations.html';
const NOW = new Date('2026-10-24T14:00:00Z');

const LATEST: DrawSummary[] = [
  { round: '450', roundNumber: 450, date: '2026-10-16', typeLabel: 'French-Language proficiency 2026-Version 2', group: 'FRENCH', invitations: 5000, crsMin: 435, irccUrl: `${IRCC}?q=450`, crsChange: 36 },
  { round: '449', roundNumber: 449, date: '2026-10-15', typeLabel: 'Canadian Experience Class', group: 'CEC', invitations: 2500, crsMin: 519, irccUrl: `${IRCC}?q=449`, crsChange: -2 },
  { round: '448', roundNumber: 448, date: '2026-10-13', typeLabel: 'Provincial Nominee Program', group: 'PNP', invitations: 752, crsMin: 772, irccUrl: `${IRCC}?q=448`, crsChange: 7 },
  { round: '447', roundNumber: 447, date: '2026-10-01', typeLabel: 'Trades Occupations, 2026-Version 3', group: 'CATEGORY', invitations: 3500, crsMin: 476, irccUrl: null, crsChange: null },
];
/** 22 older rounds, #446 down to #425, cycling PNP / CEC / GENERAL. */
const OLDER: DrawSummary[] = Array.from({ length: 22 }, (_, i) => {
  const group = (['PNP', 'CEC', 'GENERAL'] as DrawGroup[])[i % 3]!;
  const label = { PNP: 'Provincial Nominee Program', CEC: 'Canadian Experience Class', GENERAL: 'No Program Specified' }[group as 'PNP'];
  return {
    round: String(446 - i),
    roundNumber: 446 - i,
    date: new Date(Date.UTC(2026, 8, 28 - i)).toISOString().slice(0, 10),
    typeLabel: label,
    group,
    invitations: 1000 + i,
    crsMin: 500 + i,
    irccUrl: null,
    crsChange: null,
  };
});
const ALL = [...LATEST, ...OLDER];

const query = {
  list: { data: ALL as DrawSummary[] | undefined, isError: false },
  latest: {
    data: { draws: LATEST, lastSyncedAt: new Date(NOW.getTime() - 2 * 3600_000) } as
      | { draws: DrawSummary[]; lastSyncedAt: Date | null }
      | undefined,
    isError: false,
  },
};
const subscribe = vi.fn();
const unsubscribe = vi.fn();

vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));
vi.mock('@/trpc/react', () => ({
  api: {
    draws: {
      list: { useQuery: () => query.list },
      latest: { useQuery: () => query.latest },
      subscribe: { useMutation: () => ({ mutateAsync: subscribe }) },
      unsubscribe: { useMutation: () => ({ mutateAsync: unsubscribe }) },
    },
  },
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
  query.list.data = ALL;
  query.latest.data = { draws: LATEST, lastSyncedAt: new Date(NOW.getTime() - 2 * 3600_000) };
  window.localStorage.clear();
  subscribe.mockReset().mockResolvedValue(undefined);
  unsubscribe.mockReset().mockResolvedValue(undefined);
  vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BElx-test-public-key');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const latestCard = () => screen.getByRole('region', { name: 'Dernier tirage' });
const history = () => screen.getByRole('region', { name: 'Historique des tirages' });
const bodyRows = () => within(within(history()).getByRole('table')).getAllByRole('row').slice(1);
const firstCells = () => bodyRows().map((row) => within(row).getAllByRole('cell')[0]!.textContent);
const scoreBox = () => screen.getByRole('textbox', { name: 'Votre score CRS' });
const compare = (score: string) => {
  fireEvent.change(scoreBox(), { target: { value: score } });
  fireEvent.click(screen.getByRole('button', { name: 'Comparer' }));
};

describe('DrawsView — latest Tirage', () => {
  it('shows the newest round with its facts, in French', () => {
    render(withIntl(<DrawsView />));

    expect(screen.getByRole('heading', { level: 1, name: 'Les tirages, sans détour.' })).toBeInTheDocument();
    const card = within(latestCard());
    expect(card.getByRole('heading', { name: '#450' })).toBeInTheDocument();
    expect(card.getByText('16 oct. 2026')).toBeInTheDocument();
    expect(card.getByText('Connaissance du français')).toBeInTheDocument();
    expect(card.getByText(/^5\s000$/)).toBeInTheDocument();
    expect(card.getByText('435')).toBeInTheDocument();
    expect(card.getByText('+36')).toBeInTheDocument();
    expect(card.getByText('depuis le dernier tirage Français')).toBeInTheDocument();
    expect(card.getByRole('link', { name: /Voir sur IRCC/ })).toHaveAttribute('href', `${IRCC}?q=450`);
    expect(screen.getByText('Mis à jour il y a 2 heures')).toBeInTheDocument();
  });

  it('says so before the first update has run', () => {
    query.latest.data = { draws: [], lastSyncedAt: null };
    query.list.data = [];
    render(withIntl(<DrawsView />));

    expect(screen.getByText(/la première mise à jour n’a pas encore eu lieu/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Dernier tirage' })).not.toBeInTheDocument();
  });

  it('shows English labels as IRCC publishes them at /en', () => {
    render(withIntl(<DrawsView />, 'en'));

    expect(within(screen.getByRole('region', { name: 'Latest draw' })).getByText('French-Language proficiency 2026-Version 2')).toBeInTheDocument();
  });
});

describe('DrawsView — Votre score CRS', () => {
  it('says how far above the cut-off a score is', () => {
    render(withIntl(<DrawsView />));
    compare('500');
    expect(screen.getByText('Vous dépassez de 65 points')).toBeInTheDocument();
  });

  it('says how many points are missing, and offers to improve the score', () => {
    render(withIntl(<DrawsView />));
    compare('434');
    expect(screen.getByText('Il vous manque 1 point')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Améliorer mon score' })).toHaveAttribute('href', '/outils/crs');
  });

  it('shows no comparison for something that is not a CRS score', () => {
    render(withIntl(<DrawsView />));
    for (const value of ['abc', '1201', '-4']) {
      compare(value);
      expect(screen.getByText('Entrez un score CRS entre 0 et 1200.')).toBeInTheDocument();
      expect(screen.queryByText(/Vous dépassez|Il vous manque/)).not.toBeInTheDocument();
    }
  });

  it('pre-fills the score from the CRS calculator on this device', async () => {
    // Single, 29, bachelor's, CLB 9, 3 years abroad: 429 (see the CRS engine tests).
    const draft = fromProfile({
      maritalStatus: 'single', age: 29, education: 'bachelors',
      firstLanguage: { test: 'CLB', scores: { speaking: 9, listening: 9, reading: 9, writing: 9 } },
      secondLanguage: null, canadianWorkYears: 0, foreignWorkYears: 3, certificateOfQualification: false,
      canadianStudy: 'none', provincialNomination: false, siblingInCanada: false, highWageWork: 'none', highWageJobOffer: 'none',
    });
    window.localStorage.setItem(CRS_DRAFT_KEY, JSON.stringify(draft));

    render(withIntl(<DrawsView />));

    await waitFor(() => expect(scoreBox()).toHaveValue('429'));
  });
});

describe('DrawsView — Historique des tirages', () => {
  it('lists every round, newest first, ten per page, the latest marked Nouveau', () => {
    render(withIntl(<DrawsView />));

    expect(within(history()).getByText('26 tirages trouvés')).toBeInTheDocument();
    expect(firstCells()).toEqual(['#450Nouveau', '#449', '#448', '#447', '#446', '#445', '#444', '#443', '#442', '#441']);
    expect(within(history()).getByText('Affichage de 1 à 10 sur 26')).toBeInTheDocument();
  });

  it('searches by type, number, date or score', () => {
    render(withIntl(<DrawsView />));
    const search = within(history()).getByRole('searchbox', { name: 'Rechercher un tirage' });

    fireEvent.change(search, { target: { value: 'trades' } });
    expect(within(history()).getByText('1 tirage trouvé')).toBeInTheDocument();
    expect(within(bodyRows()[0]!).getByText('Métiers spécialisés')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: '772' } });
    expect(firstCells()).toEqual(['#448']);

    fireEvent.change(search, { target: { value: 'pas un tirage' } });
    expect(within(history()).getByText('Essayez une autre recherche ou un autre filtre.')).toBeInTheDocument();
  });

  it('filters by Type de tirage', () => {
    render(withIntl(<DrawsView />));

    fireEvent.click(within(history()).getByRole('button', { name: 'CEC' }));

    // #449 plus every third older round from #445.
    expect(within(history()).getByText('8 tirages trouvés')).toBeInTheDocument();
    expect(firstCells().slice(0, 3)).toEqual(['#449', '#445', '#442']);
    expect(within(history()).getByRole('button', { name: 'CEC' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sorts by any column, highest first then lowest', () => {
    render(withIntl(<DrawsView />));
    const byScore = within(history()).getByRole('button', { name: /Score CRS/ });

    fireEvent.click(byScore);
    expect(firstCells()[0]).toBe('#448');
    expect(byScore.closest('th')).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(byScore);
    expect(firstCells()[0]).toBe('#450Nouveau');
    expect(byScore.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('changes page size and pages', () => {
    render(withIntl(<DrawsView />));

    fireEvent.change(within(history()).getByRole('combobox', { name: 'Nombre de lignes par page' }), { target: { value: '25' } });
    expect(bodyRows()).toHaveLength(25);

    fireEvent.click(within(history()).getByRole('button', { name: /Suivant/ }));
    expect(within(history()).getByText('Affichage de 26 à 26 sur 26')).toBeInTheDocument();
    expect(firstCells()).toEqual(['#425']);
  });

  it('has no axe violations', async () => {
    vi.useRealTimers();
    render(withIntl(<DrawsView />));
    expect(await axe(history())).toHaveNoViolations();
  });
});

describe('DrawsView — Alertes tirages', () => {
  const alerts = () => screen.getByRole('region', { name: 'Alertes tirages' });

  /** A browser that can do push: service worker, PushManager, Notification. */
  function pushCapable({ permission = 'default', existing = null as null | object } = {}) {
    const json = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
    const created = { endpoint: json.endpoint, toJSON: () => json, unsubscribe: vi.fn().mockResolvedValue(true) };
    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(existing ? { ...created, ...existing } : null),
      subscribe: vi.fn().mockResolvedValue(created),
    };
    const registration = { pushManager };
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', { permission, requestPermission: vi.fn().mockResolvedValue('granted') });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(registration), register: vi.fn().mockResolvedValue(registration) },
    });
    return { pushManager, json, created };
  }

  /** Renders and lets the page's async browser checks settle. */
  const renderSettled = async (locale?: 'fr' | 'en') => {
    await act(async () => {
      render(withIntl(<DrawsView />, locale));
    });
  };

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('offers the WhatsApp channel when the browser cannot do push', async () => {
    await renderSettled();

    expect(await within(alerts()).findByText(/ne gère pas les notifications/)).toBeInTheDocument();
    expect(within(alerts()).getByRole('link', { name: /Rejoindre la chaîne WhatsApp/ })).toHaveAttribute(
      'href',
      expect.stringContaining('whatsapp.com/channel/'),
    );
  });

  it('turns alerts on after the visitor taps the button', async () => {
    const { pushManager, json } = pushCapable();
    await renderSettled();

    await act(async () => {
      fireEvent.click(await within(alerts()).findByRole('button', { name: 'Activer les alertes tirages' }));
    });

    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(subscribe).toHaveBeenCalledWith({ subscription: json, locale: 'fr' });
    expect(await within(alerts()).findByText('Alertes tirages activées sur cet appareil')).toBeInTheDocument();
  });

  it('lets a subscribed device turn alerts off', async () => {
    const { created } = pushCapable({ permission: 'granted', existing: {} });
    await renderSettled();

    await act(async () => {
      fireEvent.click(await within(alerts()).findByRole('button', { name: 'Désactiver les alertes' }));
    });

    expect(unsubscribe).toHaveBeenCalledWith({ endpoint: created.endpoint });
    expect(await within(alerts()).findByRole('button', { name: 'Activer les alertes tirages' })).toBeInTheDocument();
  });

  it('explains how to unblock notifications once they were denied', async () => {
    pushCapable({ permission: 'denied' });
    await renderSettled();

    expect(await within(alerts()).findByText(/Les notifications sont bloquées pour ce site/)).toBeInTheDocument();
    expect(within(alerts()).queryByRole('button', { name: 'Activer les alertes tirages' })).not.toBeInTheDocument();
  });

  it('asks iPhone visitors to add the app to their home screen first', async () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
    await renderSettled();

    expect(await within(alerts()).findByText(/ajoutez d’abord Stanzy à votre écran d’accueil/)).toBeInTheDocument();
  });

  it('is hidden when the site has no push keys', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
    pushCapable();
    await renderSettled();

    expect(screen.queryByRole('region', { name: 'Alertes tirages' })).not.toBeInTheDocument();
  });
});
