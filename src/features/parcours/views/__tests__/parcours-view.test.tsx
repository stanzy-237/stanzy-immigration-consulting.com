// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import type { Etape } from '@/features/parcours/lib/etape-schema';
import { ParcoursView } from '@/features/parcours/views/parcours-view';

/** Seam: the Parcours page as a signed-in User reads and drives it. */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));

const mutation = () => ({ mutate: vi.fn(), isPending: false, isError: false, reset: vi.fn() });
const server = {
  etapes: [] as Etape[],
  add: mutation(),
  update: mutation(),
  remove: mutation(),
};
vi.mock('@/trpc/react', () => ({
  api: {
    useUtils: () => ({ parcours: { list: { invalidate: vi.fn() } } }),
    parcours: {
      list: { useQuery: () => ({ data: server.etapes, isPending: false }) },
      add: { useMutation: () => server.add },
      update: { useMutation: () => server.update },
      delete: { useMutation: () => server.remove },
    },
  },
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T15:00:00') });
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
  server.etapes = [];
  server.add = mutation();
  server.update = mutation();
  server.remove = mutation();
});
afterEach(() => vi.useRealTimers());

const ITA: Etape = {
  id: 'e1',
  label: 'ITA reçue',
  code: 'ITA',
  emoji: '✈️',
  color: 'stanzy-red',
  date: '2026-07-17',
  note: 'Score CRS : 485 points',
};
const AOR: Etape = { id: 'e2', label: 'AOR reçu', code: 'AOR', emoji: '✅', color: 'green', date: '2026-10-14', note: '' };

const form = (name = 'Ajouter une étape') => within(screen.getByRole('region', { name }));
const type = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

describe('ParcoursView', () => {
  it('invites a new User to add their first Étape', () => {
    render(withIntl(<ParcoursView />));

    expect(screen.getByRole('heading', { name: 'Aucune étape enregistrée' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voir la timeline' })).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    vi.useRealTimers();
    server.etapes = [ITA, AOR];
    const { container } = render(withIntl(<ParcoursView />));

    expect(await axe(container)).toHaveNoViolations();
  });

  it('lists Étapes oldest first, each with its date and the days since', () => {
    server.etapes = [AOR, ITA];
    render(withIntl(<ParcoursView />));

    const feed = screen.getByRole('region', { name: 'Étapes enregistrées' });
    const cards = within(feed).getAllByRole('button', { name: /^Modifier / });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Modifier ITA reçue', 'Modifier AOR reçu']);
    expect(cards[0]).toHaveTextContent('17 juillet 2026');
    expect(cards[0]).toHaveTextContent(/90\s*jours depuis\s*ITA/);
    expect(cards[0]).toHaveTextContent('Score CRS : 485 points');
    expect(cards[1]).toHaveTextContent(/1\s*jour depuis\s*AOR/);
  });

  it('sums up the Parcours: how many Étapes and the most recent one', () => {
    server.etapes = [ITA, AOR];
    render(withIntl(<ParcoursView />));

    const summary = screen.getByRole('region', { name: 'Votre parcours' });
    expect(summary).toHaveTextContent('2 étapes enregistrées');
    expect(summary).toHaveTextContent(/AOR reçu\s*il y a 1 jour/);
  });

  it('adds a preset Étape with its label, code, icon and colour', () => {
    render(withIntl(<ParcoursView />));

    fireEvent.click(form().getByRole('button', { name: 'ITA' }));
    expect(form().getByLabelText('Nom de l’étape')).toHaveValue('Invitation à présenter une demande (ITA)');
    type(form().getByLabelText('Date'), '2026-07-17');
    expect(form().getByLabelText('Date').parentElement).toHaveTextContent(/90\s*jours depuis\s*ITA/);
    fireEvent.click(form().getByRole('button', { name: 'Ajouter l’étape' }));

    expect(server.add.mutate).toHaveBeenCalledWith(
      {
        label: 'Invitation à présenter une demande (ITA)',
        code: 'ITA',
        emoji: '✈️',
        color: 'stanzy-red',
        date: '2026-07-17',
        note: '',
      },
      expect.anything(),
    );
  });

  it('adds a free-form Étape and leaves its code to the server', () => {
    render(withIntl(<ParcoursView />));

    fireEvent.click(form().getByRole('button', { name: 'ITA' }));
    type(form().getByLabelText('Nom de l’étape'), 'Équivalence des diplômes');
    type(form().getByLabelText('Date'), '2026-09-01');
    fireEvent.click(form().getByRole('button', { name: 'Ajouter l’étape' }));

    const [input] = server.add.mutate.mock.calls[0]!;
    expect(input).toMatchObject({ label: 'Équivalence des diplômes', date: '2026-09-01' });
    expect(input).not.toHaveProperty('code');
  });

  it('asks for a name and a past date before saving', () => {
    render(withIntl(<ParcoursView />));

    fireEvent.click(form().getByRole('button', { name: 'Ajouter l’étape' }));
    expect(form().getByText('Donnez un nom à l’étape.')).toBeInTheDocument();
    expect(form().getByText('Indiquez la date de l’étape.')).toBeInTheDocument();

    type(form().getByLabelText('Nom de l’étape'), 'Biométrie');
    type(form().getByLabelText('Date'), '2026-10-16');
    fireEvent.click(form().getByRole('button', { name: 'Ajouter l’étape' }));
    expect(form().getByText('La date ne peut pas être dans le futur.')).toBeInTheDocument();
    expect(form().queryByText('Donnez un nom à l’étape.')).not.toBeInTheDocument();

    expect(server.add.mutate).not.toHaveBeenCalled();
  });

  it('opens an Étape for editing from its card and saves it in place', () => {
    server.etapes = [ITA, AOR];
    render(withIntl(<ParcoursView />));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ITA reçue' }));
    const edit = form('Modifier l’étape');
    expect(edit.getByLabelText('Nom de l’étape')).toHaveValue('ITA reçue');
    expect(edit.getByLabelText('Date')).toHaveValue('2026-07-17');
    expect(edit.getByLabelText('Note (optionnel)')).toHaveValue('Score CRS : 485 points');

    type(edit.getByLabelText('Note (optionnel)'), 'Score CRS : 491 points');
    fireEvent.click(edit.getByRole('button', { name: 'Enregistrer les modifications' }));

    expect(server.update.mutate).toHaveBeenCalledWith(
      {
        id: 'e1',
        label: 'ITA reçue',
        code: 'ITA',
        emoji: '✈️',
        color: 'stanzy-red',
        date: '2026-07-17',
        note: 'Score CRS : 491 points',
      },
      expect.anything(),
    );
  });

  it('deletes an Étape only once the User confirms', async () => {
    server.etapes = [ITA, AOR];
    render(withIntl(<ParcoursView />));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ITA reçue' }));
    fireEvent.click(form('Modifier l’étape').getByRole('button', { name: 'Supprimer cette étape' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Supprimer cette étape ?' });
    expect(confirm).toHaveTextContent('« ITA reçue » sera retirée de votre parcours.');
    expect(server.remove.mutate).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Supprimer' }));
    expect(server.remove.mutate).toHaveBeenCalledWith({ id: 'e1' }, expect.anything());
  });

  it('keeps the draft and says so when saving fails', () => {
    server.add.mutate.mockImplementation((_input: unknown, options: { onError: (e: Error) => void }) =>
      options.onError(new Error('PARCOURS_LIMIT')),
    );
    render(withIntl(<ParcoursView />));

    type(form().getByLabelText('Nom de l’étape'), 'Biométrie');
    type(form().getByLabelText('Date'), '2026-10-01');
    fireEvent.click(form().getByRole('button', { name: 'Ajouter l’étape' }));

    expect(form().getByRole('alert')).toHaveTextContent('Vous avez atteint la limite de 100 étapes.');
    expect(form().getByLabelText('Nom de l’étape')).toHaveValue('Biométrie');
  });

  it('opens a screenshot-ready timeline with notes hidden until the User shows them', async () => {
    server.etapes = [ITA, AOR];
    render(withIntl(<ParcoursView />));

    fireEvent.click(screen.getByRole('button', { name: 'Voir la timeline' }));
    const timeline = await screen.findByRole('dialog', { name: 'Mon parcours Entrée Express' });
    expect(timeline).toHaveTextContent('2 étapes enregistrées');
    expect(within(timeline).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'ITA reçue',
      'AOR reçu',
    ]);
    expect(timeline).toHaveTextContent(/90\s*jours depuis\s*ITA/);
    expect(timeline).toHaveTextContent('Créé avec Stanzy Immigration Consulting');
    expect(timeline).not.toHaveTextContent('Score CRS');

    fireEvent.click(within(timeline).getByRole('switch', { name: 'Afficher les notes' }));
    expect(timeline).toHaveTextContent('Score CRS : 485 points');
  });

  describe('on a phone', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) => ({ matches: query === '(max-width: 1023px)', media: query }) as MediaQueryList,
      );
    });
    afterEach(() => vi.restoreAllMocks());

    it('adds from the floating button in a bottom sheet', async () => {
      server.etapes = [ITA];
      render(withIntl(<ParcoursView />));

      fireEvent.click(screen.getByRole('button', { name: 'Ajouter une étape' }));
      const sheet = await screen.findByRole('dialog', { name: 'Ajouter une étape' });
      fireEvent.click(within(sheet).getByRole('button', { name: 'AOR' }));
      type(within(sheet).getByLabelText('Date'), '2026-08-03');
      fireEvent.click(within(sheet).getByRole('button', { name: 'Ajouter l’étape' }));

      expect(server.add.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AOR', date: '2026-08-03' }),
        expect.anything(),
      );
    });

    it('edits a tapped card in the bottom sheet', async () => {
      server.etapes = [ITA];
      render(withIntl(<ParcoursView />));

      fireEvent.click(screen.getByRole('button', { name: 'Modifier ITA reçue' }));
      const sheet = await screen.findByRole('dialog', { name: 'Modifier l’étape' });
      expect(within(sheet).getByLabelText('Nom de l’étape')).toHaveValue('ITA reçue');
    });
  });
});
