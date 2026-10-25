// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { ItaCountdownView } from '@/features/ita-countdown/views/ita-countdown-view';

/** Seam: the Compte à rebours ITA page as a visitor uses it, with the clock frozen. */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));

const draw = (roundNumber: number, date: string, crsMin: number, invitations: number, typeLabel = 'Canadian Experience Class') => ({
  round: String(roundNumber),
  roundNumber,
  date,
  typeLabel,
  group: 'CEC',
  invitations,
  crsMin,
  irccUrl: null,
  crsChange: null,
});
/** The newest Tirages, as `draws.latest` returns them: the server keeps the first `take`. */
const DRAWS = [
  draw(380, '2026-10-22', 518, 3000),
  draw(379, '2026-10-08', 527, 2500, 'French-Language proficiency 2026-Version 2'),
  draw(378, '2026-10-01', 401, 1800, 'Provincial Nominee Program'),
  draw(377, '2026-09-24', 470, 2000, 'Healthcare and social services occupations 2026-Version 1'),
  draw(376, '2026-09-17', 530, 1500, 'Trades Occupations, 2026-Version 3'),
  draw(375, '2026-09-10', 540, 1000),
];
/** The signed-in User's Parcours; only read when someone is signed in. */
const parcours = { etapes: [] as { id: string; code: string; date: string; label: string }[] };
vi.mock('@/trpc/react', () => ({
  api: {
    draws: { latest: { useQuery: ({ take }: { take: number }) => ({ data: { draws: DRAWS.slice(0, take), lastSyncedAt: null } }) } },
    parcours: {
      list: {
        useQuery: (_input: undefined, options?: { enabled?: boolean }) => ({
          data: options?.enabled ? parcours.etapes : undefined,
        }),
      },
    },
  },
}));
const signIn = () =>
  vi.mocked(authClient.useSession).mockReturnValue({
    data: { user: { name: 'Aminata Diallo', email: 'aminata@example.com' } },
    isPending: false,
  } as never);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: new Date('2026-10-25T15:00:00Z') });
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
  window.localStorage.clear();
  parcours.etapes = [];
});
afterEach(() => vi.useRealTimers());

const itaDate = () => screen.getByLabelText('Date de votre ITA');
const enterIta = (day: string) => fireEvent.change(itaDate(), { target: { value: day } });
const timeLeft = () => screen.getByRole('region', { name: 'Temps restant' });
const deadline = () => screen.getByRole('region', { name: 'Date limite de dépôt' });

describe('ItaCountdownView', () => {
  it('counts down the 60 days after the ITA day, to 00:00 UTC after the last one', () => {
    render(withIntl(<ItaCountdownView />));
    expect(screen.getByRole('heading', { level: 1, name: 'Compte à rebours ITA' })).toBeInTheDocument();

    // ITA on 25 Oct: the 60 days are 26 Oct – 24 Dec; the window closes 25 Dec 00:00 UTC.
    enterIta('2026-10-25');

    expect(timeLeft()).toHaveTextContent(/60\s*jours\s*09\s*heures\s*00\s*minutes\s*00\s*secondes/);
    expect(deadline()).toHaveTextContent('Dernier jour : 24 décembre 2026');
    expect(deadline()).toHaveTextContent('Fermeture le 25 décembre 2026 à 00 h 00 UTC');
    expect(deadline()).toHaveTextContent(/soit .+ à votre heure/);
    expect(deadline()).toHaveTextContent('La date et l’heure exactes figurent dans votre compte IRCC');
  });

  it('ticks every second', () => {
    render(withIntl(<ItaCountdownView />));
    enterIta('2026-10-25');

    act(() => void vi.advanceTimersByTime(61_000));

    expect(timeLeft()).toHaveTextContent(/60\s*jours\s*08\s*heures\s*58\s*minutes\s*59\s*secondes/);
  });

  it.each([
    // ITA date, days left at 25 Oct 15:00 UTC, what the visitor is told
    ['2026-10-10', 45, 'Vous avez du temps'],
    ['2026-09-05', 10, 'Moins de deux semaines'],
    ['2026-09-01', 6, 'Moins d’une semaine'],
  ])('after an ITA on %s, shows %i days left and says: %s', (day, days, advice) => {
    render(withIntl(<ItaCountdownView />));
    enterIta(day);

    expect(screen.getByRole('status')).toHaveTextContent(advice);
    expect(screen.getByRole('timer')).toHaveTextContent(new RegExp(`^${days}\\s*jours\\s*restants$`));
    expect(screen.getByRole('progressbar', { name: 'Part du délai restant' })).toHaveAttribute(
      'aria-valuenow',
      String(Math.round(((days * 24 + 9) / (60 * 24)) * 100)),
    );
  });

  it('says when the window has closed, and what that means', () => {
    render(withIntl(<ItaCountdownView />));

    // ITA on 1 Aug: last day 30 Sep, closed since 1 Oct 00:00 UTC.
    enterIta('2026-08-01');

    expect(screen.getByRole('alert')).toHaveTextContent('Votre délai est écoulé');
    expect(screen.getByRole('alert')).toHaveTextContent('votre profil est retiré du bassin Entrée Express');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Temps restant' })).not.toBeInTheDocument();
    expect(deadline()).toHaveTextContent('Dernier jour : 30 septembre 2026');
  });

  it('refuses an ITA date in the future', () => {
    render(withIntl(<ItaCountdownView />));

    enterIta('2026-10-26');

    expect(screen.getByText('La date de l’ITA ne peut pas être dans le futur.')).toBeInTheDocument();
    expect(itaDate()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Date limite de dépôt' })).not.toBeInTheDocument();
  });

  it('fills the ITA date from a recent Tirage', () => {
    render(withIntl(<ItaCountdownView />));

    fireEvent.click(screen.getByRole('button', { name: 'Derniers tirages' }));
    const draws = screen.getByRole('listbox', { name: 'Choisir la date d’un tirage récent' });
    const options = within(draws).getAllByRole('option');
    expect(options).toHaveLength(5);
    expect(options[0]).toHaveTextContent(/Tirage n° 380 · 22 oct\. 2026.*Catégorie de l’expérience canadienne.*Score minimum : 518.*3\s000 inv\./);
    expect(options[1]).toHaveTextContent('Connaissance du français');
    expect(options[4]).toHaveTextContent('Métiers spécialisés');

    fireEvent.click(options[1]!);

    expect(itaDate()).toHaveValue('2026-10-08');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(deadline()).toHaveTextContent('Dernier jour : 7 décembre 2026');
  });

  it('remembers the ITA date in this browser for the next visit', () => {
    const first = render(withIntl(<ItaCountdownView />));
    enterIta('2026-10-22');
    first.unmount();

    render(withIntl(<ItaCountdownView />));

    expect(itaDate()).toHaveValue('2026-10-22');
    expect(deadline()).toHaveTextContent('Dernier jour : 21 décembre 2026');
  });

  it('has no detectable accessibility violations, empty or counting', async () => {
    vi.useRealTimers();
    const { container } = render(withIntl(<ItaCountdownView />));
    expect(await axe(container)).toHaveNoViolations();

    enterIta('2026-10-01');
    fireEvent.click(screen.getByRole('button', { name: 'Derniers tirages' }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads "today" on the UTC calendar, like the deadline, wherever the visitor is', () => {
    // 21:00 on 25 Oct in Toronto is already 26 Oct in UTC: a Tirage dated
    // 26 Oct has happened, and its ITA must count.
    vi.stubEnv('TZ', 'America/Toronto');
    vi.setSystemTime(new Date('2026-10-26T01:00:00Z'));
    render(withIntl(<ItaCountdownView />));

    enterIta('2026-10-26');

    expect(screen.queryByText('La date de l’ITA ne peut pas être dans le futur.')).not.toBeInTheDocument();
    expect(deadline()).toHaveTextContent('Dernier jour : 25 décembre 2026');
    vi.unstubAllEnvs();
  });

  describe('for a signed-in User with a Parcours', () => {
    beforeEach(() => {
      signIn();
      parcours.etapes = [
        { id: 'e1', code: 'ITA', date: '2026-04-15', label: 'Première ITA' },
        { id: 'e2', code: 'AOR', date: '2026-05-02', label: 'AOR reçu' },
        { id: 'e3', code: 'ITA', date: '2026-10-08', label: 'ITA reçue' },
      ];
    });

    it('starts from the most recent ITA Étape, over a date kept in this browser', () => {
      window.localStorage.setItem('stanzy.ita-countdown.v1', JSON.stringify({ itaDay: '2026-10-22' }));
      render(withIntl(<ItaCountdownView />));

      expect(itaDate()).toHaveValue('2026-10-08');
      expect(deadline()).toHaveTextContent('Dernier jour : 7 décembre 2026');
      expect(screen.getByText(/Date reprise de votre parcours/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Voir mon parcours' })).toHaveAttribute('href', '/outils/timeline');
    });

    it('lets the User count from another date on this page', () => {
      render(withIntl(<ItaCountdownView />));

      enterIta('2026-10-22');

      expect(itaDate()).toHaveValue('2026-10-22');
      expect(screen.queryByText(/Date reprise de votre parcours/)).not.toBeInTheDocument();
    });
  });

  it('never reads a Parcours when nobody is signed in', () => {
    parcours.etapes = [{ id: 'e1', code: 'ITA', date: '2026-10-08', label: 'ITA reçue' }];
    render(withIntl(<ItaCountdownView />));

    expect(itaDate()).toHaveValue('');
  });
});
