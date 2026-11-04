// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierDocuments } from '@/features/dossiers/components/dossier-documents';
import type { Viewer } from '@/features/dossiers/components/document-styles';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: Documents made from a Demande d'intérêt (#81), with the Sections in the cache. */
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => vi.clearAllMocks());

const document = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  createdAt: new Date('2026-11-04T10:00:00Z'),
  finalVersionId: null,
  addedBy: { name: 'Stanzy', role: 'CONSULTANT' },
  versions: [],
  comments: [],
  signatures: [],
  kind: null,
  need: 'mandatory',
  missing: false,
  clientNote: null,
  stanzyRequests: [],
  ...extra,
});

function open(viewer: Viewer, stanzy: boolean, ask = vi.fn()) {
  const data = {
    viewer: viewer === 'client' ? { id: 'acc_1', name: 'Aminata Diallo', role: 'MEMBER' } : { id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' },
    open: true,
    locked: false,
    stanzy,
    sections: [
      {
        id: 'sec_1',
        title: 'Preuve de ressources financières suffisantes – Requérant principal',
        documents: [
          document('doc_1', 'Lettre de la banque', { kind: 'bankLetter', missing: true, clientNote: 'Relevé de 4 mois' }),
          document('doc_2', 'Résultats du test de langue', { kind: 'languageResults', missing: true }),
          document('doc_3', 'Relevés bancaires', { kind: 'bankStatements', need: 'recommended' }),
        ],
      },
    ],
  };
  const { trpc, queryClient, wrap } = createTestTRPC({
    'dossiers.documents.sections': () => data,
    'accompagnement.stanzy.request': (input) => ask(input) ?? { id: 'stz_1' },
  });
  queryClient.setQueryData(trpc.dossiers.documents.sections.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierDocuments dossierId="dos_1" viewer={viewer} />)));
}

describe('Documents made from the Demande d’intérêt', () => {
  it('shows ★ Obligatoire, Recommandé and « Manquant »', () => {
    open('client', false);
    expect(screen.getAllByText('★ Obligatoire')).toHaveLength(2);
    expect(screen.getByText('Recommandé')).toBeInTheDocument();
    expect(screen.getAllByText('Manquant')).toHaveLength(2);
  });

  it('lets a Client in Cameroon ask Stanzy for a missing one, with their note', async () => {
    const ask = vi.fn();
    const { container } = open('client', true, ask);
    fireEvent.click(screen.getByRole('button', { name: /^Lettre de la banque/ }));
    expect(screen.getByText('Votre note : Relevé de 4 mois')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole('button', { name: 'Demander à Stanzy d’obtenir « Lettre de la banque »' }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith({ documentId: 'doc_1' }));
  });

  it('points a missing language test to the TCF, and has no Stanzy button outside Cameroon', () => {
    open('client', false);
    fireEvent.click(screen.getByRole('button', { name: /^Résultats du test de langue/ }));
    expect(screen.getByRole('link', { name: /Préparer le TCF/ })).toHaveAttribute('href', 'https://tcf-express-academy.com');
    expect(screen.queryByRole('button', { name: /Demander à Stanzy/ })).not.toBeInTheDocument();
  });

  it('shows the consultant the Client’s note', () => {
    open('consultant', false);
    fireEvent.click(screen.getByRole('button', { name: /^Lettre de la banque/ }));
    expect(screen.getByText('Note du client : Relevé de 4 mois')).toBeInTheDocument();
  });
});
