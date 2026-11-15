// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { EMPTY_ANSWERS } from '@/features/document-services/lib/requirements';
import { RequirementsView } from '@/features/document-services/views/requirements-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the page of what to hand over for a request, with its data in the cache as the route prefetches it. */
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => vi.clearAllMocks());

const pof = STARTER_SERVICES.find((service) => service.slug === 'preuve-de-fonds-sans-fonds')!;
const item = (index: number, state: 'given' | 'inDossier' | 'missing', extra = {}) => ({
  ...pof.prerequisites[index]!,
  files: [],
  document: null,
  state,
  ...extra,
});

function page(save = vi.fn()) {
  const data = {
    request: {
      id: 'stz_1',
      status: 'REQUESTED',
      createdAt: new Date('2026-11-07T10:00:00Z'),
      document: { id: 'doc_bank', title: 'Lettre de la banque' },
      service: { slug: pof.slug, name: pof.name },
    },
    dossier: { id: 'dos_1', client: 'Aminata Diallo' },
    editable: true,
    items: [
      item(0, 'inDossier', { document: { id: 'doc_photo', kind: 'photo', title: 'Photo' } }),
      item(1, 'missing'),
      item(2, 'given', {
        files: [{ id: 'rf_1', key: 'plan-de-localisation', fileName: 'plan.jpg', contentType: 'image/jpeg', size: 1000, createdAt: new Date() }],
      }),
    ],
    questionnaire: pof.questionnaire,
    answers: EMPTY_ANSWERS,
    questionsLeft: ['niu', 'contacts', 'donation', 'ubaAccount'],
    complete: false,
  };
  const { trpc, queryClient, wrap } = createTestTRPC({
    'documentServices.requirements.get': () => data,
    'documentServices.requirements.saveAnswers': (input) => save(input),
  });
  queryClient.setQueryData(trpc.documentServices.requirements.get.queryKey({ requestId: 'stz_1' }), data as never);
  return render(withIntl(wrap(<RequirementsView requestId="stz_1" viewer="client" />)));
}

describe('what the Client hands over for a service', () => {
  it('shows each item, a Checklist document of the Dossier covering the photo, and the files handed over', async () => {
    const { container } = page();
    expect(screen.getByRole('heading', { name: 'Preuve de fonds (vous n’avez pas les fonds)' })).toBeInTheDocument();
    expect(screen.getByText('Photo', { selector: 'li span' }).closest('li')).toHaveTextContent('Dans votre dossier');
    expect(screen.getByRole('link', { name: /plan\.jpg/ })).toHaveAttribute('href', '/api/requirements/files/rf_1');
    // The signature is drawn, not uploaded.
    expect(screen.getByRole('button', { name: 'Signer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retour au dossier/ })).toHaveAttribute(
      'href',
      '/fr/mon-espace/dossiers/dos_1?document=doc_bank#documents',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('asks for the donor with a gift, warns to close a UBA account, and saves the answers', async () => {
    const save = vi.fn();
    page(save);
    const form = screen.getByRole('heading', { name: 'Vos informations' }).closest('form')!;
    fireEvent.change(within(form).getByLabelText(/NIU/), { target: { value: 'M012345678901A' } });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Les fonds sont-ils un don ?' })).getByLabelText('Oui'));
    expect(within(form).getByLabelText('E-mail du donateur')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Avez-vous déjà un compte UBA ?' })).getByLabelText('Oui'));
    expect(screen.getByRole('note')).toHaveTextContent('Fermez ce compte');
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'stz_1',
          answers: expect.objectContaining({ niu: 'M012345678901A', donation: true, ubaAccount: true }),
        }),
      ),
    );
  });

  it('asks for each salary account’s company and period once there is one (#147)', async () => {
    const save = vi.fn();
    const { container } = page(save);
    const form = screen.getByRole('heading', { name: 'Vos informations' }).closest('form')!;
    expect(within(form).queryByLabelText('Entreprise (compte 1)')).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Aurez-vous besoin d’un compte salaire ?' })).getByLabelText('Oui'),
    );
    fireEvent.change(within(form).getByLabelText('Entreprise (compte 1)'), { target: { value: 'Brasseries du Cameroun' } });
    fireEvent.change(within(form).getByLabelText('Début (compte 1)'), { target: { value: '2020-01-01' } });
    fireEvent.click(within(form).getByLabelText('Toujours en cours (compte 1)'));
    fireEvent.change(within(form).getByLabelText('Fin (compte 1)'), { target: { value: '2024-06-30' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Ajouter un compte de salaire' }));
    expect(within(form).getByLabelText('Entreprise (compte 2)')).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Retirer le compte de salaire 2' }));
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: expect.objectContaining({
            salaryAccount: true,
            salaryAccounts: [{ company: 'Brasseries du Cameroun', startOn: '2020-01-01', endOn: '2024-06-30' }],
          }),
        }),
      ),
    );
  }, 30_000);
});
