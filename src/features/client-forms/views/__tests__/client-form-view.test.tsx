// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { HistoryForm } from '@/features/client-forms/components/history-form';
import { EMPTY_HISTORY, type PersonalHistory } from '@/features/client-forms/lib/form-schema';
import { ClientFormView } from '@/features/client-forms/views/client-form-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Renseignements du client forms with their data in the cache, as the routes prefetch it. */
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
}));

const today = new Date('2026-11-07T10:00:00Z');

describe('the Historique personnel form', () => {
  it('names each gap of the 10 years, and fills one with a dated period', () => {
    let value: PersonalHistory = {
      ...EMPTY_HISTORY,
      birthDate: '1990-01-01',
      activities: [
        { id: 'a', from: '2016-12', to: '2019-02', kind: 'study', title: 'Université', city: 'Douala', country: 'Cameroun', status: '' },
        { id: 'b', from: '2019-06', to: null, kind: 'work', title: 'Comptable', city: 'Douala', country: 'Cameroun', status: '' },
      ],
    };
    const onChange = vi.fn((next: PersonalHistory) => (value = next));
    render(withIntl(<HistoryForm value={value} onChange={onChange} disabled={false} today={today} />));

    const gaps = screen.getAllByRole('list', { name: 'Périodes manquantes' });
    expect(within(gaps[0]!).getByText('Période manquante : mars 2019 – mai 2019')).toBeInTheDocument();
    fireEvent.click(within(gaps[0]!).getByRole('button', { name: 'Ajouter cette période' }));
    expect(value.activities.at(-1)).toMatchObject({ from: '2019-03', to: '2019-05' });
  });
});

describe('ClientFormView', () => {
  it('starts the family with the applicant and saves it whole', async () => {
    const save = vi.fn();
    const data = {
      document: { id: 'doc_family', title: 'Renseignements sur la famille', dossierId: 'dos_1' },
      kind: 'familyInformation',
      data: { members: [] },
      complete: false,
      updatedAt: null,
      updatedBy: null,
      editable: true,
    };
    const { trpc, queryClient, wrap } = createTestTRPC({
      'clientForms.get': () => data,
      'clientForms.save': (input) => save(input) ?? { complete: false },
    });
    queryClient.setQueryData(trpc.clientForms.get.queryKey({ documentId: 'doc_family' }), data as never);
    render(withIntl(wrap(<ClientFormView documentId="doc_family" viewer="client" />)));

    expect(screen.getByText('Requérant principal', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/Ajoutez votre mère \(même décédée\)\./)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nom complet'), { target: { value: 'Aminata Diallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        documentId: 'doc_family',
        kind: 'familyInformation',
        data: { members: [expect.objectContaining({ relation: 'applicant', name: 'Aminata Diallo' })] },
      }),
    );
  });
});
