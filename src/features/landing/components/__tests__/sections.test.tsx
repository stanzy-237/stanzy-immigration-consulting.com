// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsultationCta } from '@/features/landing/components/consultation-cta';
import { Draws } from '@/features/landing/components/draws';
import { Faq } from '@/features/landing/components/faq';
import { ServicesGrid } from '@/features/landing/components/services-grid';
import { Subscribe } from '@/features/landing/components/subscribe';
import { WhyStanzy } from '@/features/landing/components/why-stanzy';

import { withIntl } from './test-utils';

const latest = vi.hoisted(() => ({
  data: undefined as unknown,
}));
vi.mock('@/trpc/react', () => ({
  api: { draws: { latest: { useQuery: () => latest } } },
}));

const draw = (round: number, typeLabel: string, group: string, crsMin: number, invitations = 1500) => ({
  round: String(round),
  roundNumber: round,
  date: `2026-10-${round - 434}`,
  typeLabel,
  group,
  invitations,
  crsMin,
  irccUrl: null,
  crsChange: null,
  tieBreakAt: '2026-10-06T21:31:22.000Z',
});
const FOUR = [
  draw(450, 'French-Language proficiency 2026-Version 2', 'FRENCH', 435, 5000),
  draw(449, 'Canadian Experience Class', 'CEC', 519),
  draw(448, 'Provincial Nominee Program', 'PNP', 772, 752),
  draw(447, 'Trades Occupations, 2026-Version 3', 'CATEGORY', 476),
];
/** The featured Tirage's facts, term → value, as its description list reads. */
const factsOf = (card: HTMLElement) =>
  Object.fromEntries(
    within(card).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]),
  );

describe('Draws', () => {
  it('shows the latest stored round and the three before it', () => {
    latest.data = {
      lastSyncedAt: new Date(),
      draws: [
        draw(450, 'French-Language proficiency 2026-Version 2', 'FRENCH', 435),
        draw(449, 'Canadian Experience Class', 'CEC', 519),
        draw(448, 'Provincial Nominee Program', 'PNP', 772),
        draw(447, 'Trades Occupations, 2026-Version 3', 'CATEGORY', 476),
      ],
    };
    render(withIntl(<Draws />));
    expect(screen.getByText(/#450/)).toBeInTheDocument();
    expect(screen.getAllByText('Connaissance du français').length).toBeGreaterThan(0);
    for (const round of ['449', '448', '447']) {
      expect(screen.getByRole('heading', { name: `Tirage #${round}` })).toBeInTheDocument();
    }
    expect(screen.getAllByText('15 oct. 2026').length).toBeGreaterThan(0);
  });

  it('leads the latest Tirage with its minimum score, then its category, invitations, date and tie-break', () => {
    latest.data = { lastSyncedAt: new Date(), draws: FOUR };
    render(withIntl(<Draws />));
    const card = screen.getByRole('article', { name: 'Dernier tirage' });

    expect(within(card).getByText('Tirage #450')).toBeInTheDocument();
    expect(within(card).getByText('435').nextElementSibling).toHaveTextContent('Score CRS minimum');
    expect(factsOf(card)).toEqual({
      Catégorie: 'Connaissance du français',
      'Invitations émises': '5\u202f000', // French groups digits with a narrow no-break space
      'Date du tirage': '16 oct. 2026',
      'Règle de bris d’égalité': '6 oct. 2026 à 21:31 UTC',
    });
    // The old « vs minimum » bar showed a made-up 72 %.
    expect(screen.queryByText('Votre score vs minimum')).not.toBeInTheDocument();
  });

  it('shows each earlier Tirage by its score, its type in short for phones and in full for wider screens', () => {
    latest.data = { lastSyncedAt: new Date(), draws: FOUR };
    render(withIntl(<Draws />));
    const pnp = screen.getByRole('heading', { name: 'Tirage #448' }).closest('a')!;

    expect(within(pnp).getAllByText('772').length).toBeGreaterThan(0);
    expect(within(pnp).getByText('PCP')).toBeInTheDocument();
    expect(within(pnp).getByText('Programme des candidats des provinces')).toBeInTheDocument();
    expect(within(pnp).getAllByText(/752/).length).toBeGreaterThan(0);
  });

  it('labels the minimum score in English at /en', () => {
    latest.data = { lastSyncedAt: new Date(), draws: [draw(450, 'French-Language proficiency 2026-Version 2', 'FRENCH', 435)] };
    render(withIntl(<Draws />, 'en'));
    expect(screen.queryByText(/Score min/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Min(imum)? (CRS )?score/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('French-Language proficiency 2026-Version 2').length).toBeGreaterThan(0);
  });

  it('shows only the header and link until the first rounds are stored', () => {
    latest.data = { lastSyncedAt: null, draws: [] };
    render(withIntl(<Draws />));
    expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir les derniers tirages/i })).toBeInTheDocument();
  });
  it('exposes a "latest draws" CTA linking to the dernier-tirage tool', () => {
    render(withIntl(<Draws />));
    const link = screen.getByRole('link', {
      name: /Voir les derniers tirages/i,
    });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/outils/dernier-tirage'),
    );
  });
});

describe('ConsultationCta', () => {
  it('renders a Booker CTA that routes to /services/consultation', () => {
    render(withIntl(<ConsultationCta />));
    const cta = screen.getByRole('link', { name: /Booker une consultation/i });
    expect(cta).toHaveAttribute(
      'href',
      expect.stringContaining('/services/consultation'),
    );
  });
});

describe('ServicesGrid', () => {
  it('renders four service cards with correct hrefs', () => {
    render(withIntl(<ServicesGrid />));
    const expected: ReadonlyArray<[RegExp, string]> = [
      [/Accompagnement Entrée Express/i, '/services/accompagnement'],
      [/Vérification & soumission/i, '/services/verification'],
      [/Formation TCF Canada/i, 'tcf-express-academy.com'],
      [/Évaluation des Diplômes/i, '/services/ede'],
    ];
    for (const [name, href] of expected) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', expect.stringContaining(href));
    }
  });
  it('opens the external TCF service in a new tab', () => {
    render(withIntl(<ServicesGrid />));
    const link = screen.getByRole('link', { name: /Formation TCF Canada/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

describe('WhyStanzy', () => {
  it('surfaces three value props and the featured proof pill', () => {
    render(withIntl(<WhyStanzy />));
    expect(screen.getByText(/experts, pas des stagiaires/i)).toBeInTheDocument();
    expect(screen.getByText(/Un seul interlocuteur/i)).toBeInTheDocument();
    expect(screen.getByText(/outils gratuits, toujours accessibles/i)).toBeInTheDocument();
    expect(screen.getByText('80% de réussite')).toBeInTheDocument();
  });
});

describe('Subscribe', () => {
  it('renders an email input and a WhatsApp channel link', () => {
    render(withIntl(<Subscribe />));
    expect(
      screen.getByPlaceholderText(/exemple@email\.com/i),
    ).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', {
      name: /Rejoindre le canal WhatsApp/i,
    });
    expect(whatsapp).toHaveAttribute(
      'href',
      expect.stringContaining('whatsapp.com/channel/'),
    );
    expect(whatsapp).toHaveAttribute('target', '_blank');
  });
});

describe('Faq', () => {
  it('opens the first item by default and toggles another on click', () => {
    render(withIntl(<Faq />));
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
  });
});
